import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FinderForm } from "@/components/FinderForm";
import { uuidPattern } from "@/features/moderation/service";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { finderPosts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
export default async function EditFinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>;
  const [post] = await getDb().select().from(finderPosts).where(eq(finderPosts.id, id));
  if (!post || post.ownerId !== viewer.id) notFound();
  if (post.status !== "ACTIVE") return <div className="auth-page page-shell"><div className="auth-card"><h1>종료된 글은 수정할 수 없습니다.</h1><Link href={`/finder/${id}`}>글로 돌아가기</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG FINDER / EDIT</p><h1>분실물 글 수정</h1><FinderForm initial={post} /><p className="auth-footer"><Link href={`/finder/${id}`}>← 글로 돌아가기</Link></p></div></div>;
}
