/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
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
// 기능 `EditFinderPage`({ params }): 먼저 `const { id } = await params;`를 실행한다.
export default async function EditFinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 조건 `!uuidPattern.test(id)`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!uuidPattern.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer || !viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!viewer`: 거짓인 경우에만 오른쪽 `!viewer.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><h1>학생 인증이 필요합니다.</h1><Link href="/me">학생 인증하기</Link></div></div>;
  const [post] = await getDb().select().from(finderPosts).where(eq(finderPosts.id, id));
  // 조건 `!post || post.ownerId !== viewer.id`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!post`: 거짓인 경우에만 오른쪽 `post.ownerId !== viewer.id`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!post || post.ownerId !== viewer.id) notFound();
  // 조건 `post.status !== "ACTIVE"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><h1>종료된 글은 수정할 수 없습니다.</h1><Link href={`/finder/${id}`}>글로 돌아가기</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (post.status !== "ACTIVE") return <div className="auth-page page-shell"><div className="auth-card"><h1>종료된 글은 수정할 수 없습니다.</h1><Link href={`/finder/${id}`}>글로 돌아가기</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG FINDER / EDIT</p><h1>분실물 글 수정</h1><FinderForm initial={post} /><p className="auth-footer"><Link href={`/finder/${id}`}>← 글로 돌아가기</Link></p></div></div>;
}
