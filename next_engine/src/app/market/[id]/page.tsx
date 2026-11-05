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
export default async function MarketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!marketId.safeParse(id).success) notFound();
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  if (!post) notFound();
  const current = await getCurrentUser(await headers());
  const active = current?.emailVerified && current.status === "ACTIVE_STUDENT";
  const isOwner = active && current.id === post.ownerId;
  let isRequester = false;
  if (active && post.status === "RESERVED") {
    const [reservation] = await getDb().select({ requesterId: marketReservations.requesterId }).from(marketReservations).where(and(eq(marketReservations.postId, id), eq(marketReservations.status, "ACTIVE")));
    isRequester = reservation?.requesterId === current.id;
  }
  const images = await visibleImages(getDb(), "market", [id], active ? current.id : undefined);
  const actions: ("reserve" | "cancel" | "complete" | "delete")[] = [];
  if (isOwner && post.status === "AVAILABLE") actions.push("delete");
  if (active && !isOwner && post.status === "AVAILABLE") actions.push("reserve");
  if (isOwner && post.status === "RESERVED") actions.push("complete", "cancel");
  else if (isRequester) actions.push("cancel");
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
