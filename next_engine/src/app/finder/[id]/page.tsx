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
// 이 상세 화면은 공개 목록과 달리 인증된 원 작성자의 글만 보여준다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function FinderOwnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 아래에 있는 작업을 실행한다.
  if (!uuidPattern.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: ((viewer 없음 또는 false) 또는 (viewer의 이메일 인증 여부 없음 또는 false)) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>;
  const [post] = await getDb().select().from(finderPosts).where(eq(finderPosts.id, id));
  // 확인할 조건: (게시글 없음 또는 false) 또는 (게시글의 작성자 번호 ≠ viewer의 고유 번호). 해당하면 아래에 있는 작업을 실행한다.
  if (!post || post.ownerId !== viewer.id) notFound();
  // 선택 기준: 게시글의 분실·습득 종류 = “분실”. 맞으면 “분실” 값을 사용하고, 아니면 “습득” 값을 사용한다.
  // 선택 기준: 게시글의 상태 = “진행 중”. 맞으면 “진행 중” 값을 사용하고, 아니면 “종료” 값을 사용한다.
  return <div className="subpage page-shell"><Link className="text-link" href="/me">← 마이페이지</Link><div className="subpage-heading"><div><p className="eyebrow">GWG FINDER / MY POST</p><h1>{post.title}</h1><p>{post.kind === "lost" ? "분실" : "습득"} · {post.status === "ACTIVE" ? "진행 중" : "종료"}</p></div></div>
    <p>{post.category} · {post.color} · {post.generalLocation} · {post.occurredAt}</p>
    {post.status === "ACTIVE" && <div className="market-actions"><Link className="button" href={`/finder/${id}/edit`}>글 수정</Link><Link className="button" href={`/finder/${id}/matches`}>추천 후보 보기</Link></div>}
    <FinderActions id={id} active={post.status === "ACTIVE"} />
  </div>;
}
