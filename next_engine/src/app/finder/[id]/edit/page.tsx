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
// 인증된 작성자의 진행 중인 글만 수정 폼에 넘긴다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function EditFinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 아래에 있는 작업을 실행한다.
  if (!uuidPattern.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: ((viewer 없음 또는 false) 또는 (viewer의 이메일 인증 여부 없음 또는 false)) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>;
  const [post] = await getDb().select().from(finderPosts).where(eq(finderPosts.id, id));
  // 확인할 조건: (게시글 없음 또는 false) 또는 (게시글의 작성자 번호 ≠ viewer의 고유 번호). 해당하면 아래에 있는 작업을 실행한다.
  if (!post || post.ownerId !== viewer.id) notFound();
  // 확인할 조건: 게시글의 상태 ≠ “진행 중”. 해당하면 해당 화면을 돌려준다.
  if (post.status !== "ACTIVE") return <div className="auth-page page-shell"><div className="auth-card"><h1>종료된 글은 수정할 수 없습니다.</h1><Link href={`/finder/${id}`}>글로 돌아가기</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG FINDER / EDIT</p><h1>분실물 글 수정</h1><FinderForm initial={post} /><p className="auth-footer"><Link href={`/finder/${id}`}>← 글로 돌아가기</Link></p></div></div>;
}
