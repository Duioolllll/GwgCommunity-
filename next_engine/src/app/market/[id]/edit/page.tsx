import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketForm } from "@/components/MarketForm";
import { marketId } from "@/features/market/data";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketPosts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export default async function EditMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!marketId.safeParse(id).success) notFound();
  const user = await getCurrentUser(await headers());
  if (!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link className="text-link" href="/auth/login">로그인하기 ↗</Link></div></div>;
  const [post] = await getDb().select().from(marketPosts).where(eq(marketPosts.id, id));
  if (!post) notFound();
  if (post.ownerId !== user.id || post.status !== "AVAILABLE") return <div className="auth-page page-shell"><div className="auth-card"><h1>상품을 수정할 수 없습니다.</h1><Link className="text-link" href={`/market/${id}`}>상품으로 돌아가기 ↗</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / EDIT</p><h1>상품 수정</h1><MarketForm initial={post} /><p className="auth-footer"><Link href={`/market/${id}`}>← 상품으로 돌아가기</Link></p></div></div>;
}
