import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FinderActions } from "@/components/FinderActions";
import { uuidPattern } from "@/features/moderation/service";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finderPosts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export default async function FinderOwnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>;
  const [post] = await getDb().select().from(finderPosts).where(eq(finderPosts.id, id));
  if (!post || post.ownerId !== viewer.id) notFound();
  return <div className="subpage page-shell"><Link className="text-link" href="/me">← 마이페이지</Link><div className="subpage-heading"><div><p className="eyebrow">GWG FINDER / MY POST</p><h1>{post.title}</h1><p>{post.kind === "lost" ? "분실" : "습득"} · {post.status === "ACTIVE" ? "진행 중" : "종료"}</p></div></div>
    <p>{post.category} · {post.color} · {post.generalLocation} · {post.occurredAt}</p>
    {post.status === "ACTIVE" && <div className="market-actions"><Link className="button" href={`/finder/${id}/edit`}>글 수정</Link><Link className="button" href={`/finder/${id}/matches`}>추천 후보 보기</Link></div>}
    <FinderActions id={id} active={post.status === "ACTIVE"} />
  </div>;
}
