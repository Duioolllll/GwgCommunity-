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
// MarketDetail 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
export default async function MarketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 확인할 조건: 고유 번호을 검사한 결과의 입력 검사 통과 여부 없음 또는 false. 해당하면 아래에 있는 작업을 실행한다.
  if (!marketId.safeParse(id).success) notFound();
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  // 확인할 조건: 게시글 없음 또는 false. 해당하면 아래에 있는 작업을 실행한다.
  if (!post) notFound();
  const current = await getCurrentUser(await headers());
  const active = current?.emailVerified && current.status === "ACTIVE_STUDENT";
  const isOwner = active && current.id === post.ownerId;
  let isRequester = false;
  // 확인할 조건: (진행 중 표시 있음 또는 true) 그리고 (게시글의 상태 = “예약 중”). 해당하면 이 경우에 필요한 자료를 준비한다.
  if (active && post.status === "RESERVED") {
    const [reservation] = await getDb().select({ requesterId: marketReservations.requesterId }).from(marketReservations).where(and(eq(marketReservations.postId, id), eq(marketReservations.status, "ACTIVE")));
    isRequester = reservation?.requesterId === current.id;
  }
  // 선택 기준: 진행 중 표시 있음 또는 true. 맞으면 현재 값의 고유 번호를 사용하고, 아니면 undefined를 사용한다.
  const images = await visibleImages(getDb(), "market", [id], active ? current.id : undefined);
  const actions: ("reserve" | "cancel" | "complete" | "delete")[] = [];
  // 확인할 조건: (isOwner 있음 또는 true) 그리고 (게시글의 상태 = “판매 중”). 해당하면 아래에 있는 작업을 실행한다.
  if (isOwner && post.status === "AVAILABLE") actions.push("delete");
  // 확인할 조건: ((진행 중 표시 있음 또는 true) 그리고 (isOwner 없음 또는 false)) 그리고 (게시글의 상태 = “판매 중”). 해당하면 아래에 있는 작업을 실행한다.
  if (active && !isOwner && post.status === "AVAILABLE") actions.push("reserve");
  // 확인할 조건: (isOwner 있음 또는 true) 그리고 (게시글의 상태 = “예약 중”). 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
  // 확인할 조건: isRequester 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
  if (isOwner && post.status === "RESERVED") actions.push("complete", "cancel");
  else if (isRequester) actions.push("cancel");
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: 게시글의 가격 = 0. 맞으면 “나눔” 값을 사용하고, 아니면 필요한 값을 넣어 만든 글자를 사용한다.
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
