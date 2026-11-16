/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
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
// 기능 `FinderOwnPage`({ params }): 먼저 `const { id } = await params;`를 실행한다.
export default async function FinderOwnPage({ params }: { params: Promise<{ id: string }> }) {
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
  // 선택 조건 `post.kind === "lost"`: 참이면 `"분실"`, 거짓이면 `"습득"`를 사용한다.
  // 선택 조건 `post.status === "ACTIVE"`: 참이면 `"진행 중"`, 거짓이면 `"종료"`를 사용한다.
  // 단락 분기 `post.status === "ACTIVE"`: 참인 경우에만 오른쪽 `<div className="market-actions"><Link className="button" href={`/finder/${id}/edit`}>글 수정</Link><Link className="button" href={`/finder/${id}/matches`}>추천 후보 보기</Link></div>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="subpage page-shell"><Link className="text-link" href="/me">← 마이페이지</Link><div className="subpage-heading"><div><p className="eyebrow">GWG FINDER / MY POST</p><h1>{post.title}</h1><p>{post.kind === "lost" ? "분실" : "습득"} · {post.status === "ACTIVE" ? "진행 중" : "종료"}</p></div></div>
    <p>{post.category} · {post.color} · {post.generalLocation} · {post.occurredAt}</p>
    {post.status === "ACTIVE" && <div className="market-actions"><Link className="button" href={`/finder/${id}/edit`}>글 수정</Link><Link className="button" href={`/finder/${id}/matches`}>추천 후보 보기</Link></div>}
    <FinderActions id={id} active={post.status === "ACTIVE"} />
  </div>;
}
