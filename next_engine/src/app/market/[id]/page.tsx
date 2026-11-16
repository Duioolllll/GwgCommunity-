/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { visibleImages } from "@/lib/storage/attachments";
import { notFound } from "next/navigation";
import { MarketActions } from "@/components/MarketActions";
import { marketId, marketStatusLabels } from "@/features/market/data";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketPosts, marketReservations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
// 소유자·예약 신청자와 상품 상태에 따라 화면에 표시할 작업을 구성한다.
// 기능 `MarketDetail`({ params }): 먼저 `const { id } = await params;`를 실행한다.
export default async function MarketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) notFound();
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  // 조건 `!post`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!post) notFound();
  const current = await getCurrentUser(await headers());
  // 단락 분기 `current?.emailVerified`: 참인 경우에만 오른쪽 `current.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const active = current?.emailVerified && current.status === "ACTIVE_STUDENT";
  // 단락 분기 `active`: 참인 경우에만 오른쪽 `current.id === post.ownerId`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const isOwner = active && current.id === post.ownerId;
  let isRequester = false;
  // 조건 `active && post.status === "RESERVED"`: 참이면 먼저 `const [reservation] = await getDb().select({ requesterId: marketReservations.requesterId }).from(marketReservations).where(and(eq(marketReservations.postId, id), eq(marketReservations.status, "ACTIVE")));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `active`: 참인 경우에만 오른쪽 `post.status === "RESERVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (active && post.status === "RESERVED") {
    const [reservation] = await getDb().select({ requesterId: marketReservations.requesterId }).from(marketReservations).where(and(eq(marketReservations.postId, id), eq(marketReservations.status, "ACTIVE")));
    isRequester = reservation?.requesterId === current.id;
  }
  // 선택 조건 `active`: 참이면 `current.id`, 거짓이면 `undefined`를 사용한다.
  const images = await visibleImages(getDb(), "market", [id], active ? current.id : undefined);
  const actions: ("reserve" | "cancel" | "complete" | "delete")[] = [];
  // 조건 `isOwner && post.status === "AVAILABLE"`: 참이면 먼저 `actions.push("delete");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `isOwner`: 참인 경우에만 오른쪽 `post.status === "AVAILABLE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (isOwner && post.status === "AVAILABLE") actions.push("delete");
  // 조건 `active && !isOwner && post.status === "AVAILABLE"`: 참이면 먼저 `actions.push("reserve");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `active && !isOwner`: 참인 경우에만 오른쪽 `post.status === "AVAILABLE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `active`: 참인 경우에만 오른쪽 `!isOwner`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (active && !isOwner && post.status === "AVAILABLE") actions.push("reserve");
  // 조건 `isOwner && post.status === "RESERVED"`: 참이면 먼저 `actions.push("complete", "cancel");`를 실행한다. 거짓이면 `isRequester` 조건을 추가로 검사한다.
  // 단락 분기 `isOwner`: 참인 경우에만 오른쪽 `post.status === "RESERVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 조건 `isRequester`: 참이면 먼저 `actions.push("cancel");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (isOwner && post.status === "RESERVED") actions.push("complete", "cancel");
  else if (isRequester) actions.push("cancel");
  // 기능 `콜백`(image): `<Image unoptimized key={image.id} src={`/api/media/${image.id}`} alt={`${post.title} 이미지`} width={400} height={400} style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }} />` 평가 결과를 반환한다.
  // 선택 조건 `post.price === 0`: 참이면 `"나눔"`, 거짓이면 ``${post.price.toLocaleString("ko-KR")}원``를 사용한다.
  // 단락 분기 `isOwner && post.status === "AVAILABLE"`: 참인 경우에만 오른쪽 `<Link className="text-link" href={`/market/${id}/edit`}>상품 수정하기 ↗</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `isOwner`: 참인 경우에만 오른쪽 `post.status === "AVAILABLE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!active && post.status === "AVAILABLE"`: 참인 경우에만 오른쪽 `<p className="muted-copy"><Link className="text-link" href="/auth/login">학생 로그인 후 거래를 신청할 수 있습니다. ↗</Link></p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!active`: 참인 경우에만 오른쪽 `post.status === "AVAILABLE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="subpage page-shell market-detail">
    <Link className="text-link" href="/market">← Market으로 돌아가기</Link>
    <div className="market-detail-grid"><div className="listing-image market-detail-image">{images.map(image => <Image unoptimized key={image.id} src={`/api/media/${image.id}`} alt={`${post.title} 이미지`} width={400} height={400} style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }} />)}</div><div>
      <p className="eyebrow">{post.category} / {marketStatusLabels[post.status]}</p><h1>{post.title}</h1><p className="market-price">{post.price === 0 ? "나눔" : `${post.price.toLocaleString("ko-KR")}원`}</p>
      <p className="market-description">{post.description}</p>
      {isOwner && post.status === "AVAILABLE" && <Link className="text-link" href={`/market/${id}/edit`}>상품 수정하기 ↗</Link>}
      <MarketActions id={id} actions={actions} />
      {!active && post.status === "AVAILABLE" && <p className="muted-copy"><Link className="text-link" href="/auth/login">학생 로그인 후 거래를 신청할 수 있습니다. ↗</Link></p>}
    </div></div>
  </div>;
}
