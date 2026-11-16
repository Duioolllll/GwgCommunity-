/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

// 추천 조회는 서비스에 작성자 ID를 전달하고 접근 오류는 찾을 수 없음으로 표시한다.
// 기능 `FinderMatchesPage`({ params }): 먼저 `const { id } = await params;`를 실행한다.
export default async function FinderMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 조건 `!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `<div className="page-shell subpage"><h1>학생 인증이 필요합니다</h1><p>추천 후보는 인증된 작성자가 확인할 수 있습니다.</p><Link href="/auth/login">로그인</Link></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer || !viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!viewer`: 거짓인 경우에만 오른쪽 `!viewer.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="page-shell subpage"><h1>학생 인증이 필요합니다</h1><p>추천 후보는 인증된 작성자가 확인할 수 있습니다.</p><Link href="/auth/login">로그인</Link></div>;
  let matches;
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof FinderMatchError` 조건을 추가로 검사한다.
  // 조건 `error instanceof FinderMatchError`: 참이면 먼저 `notFound();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  try { matches = await getFinderMatches(getDb(), id, viewer.id); }
  catch (error) { if (error instanceof FinderMatchError) notFound(); throw error; }
  // 기능 `콜백`({ post, score }): `<article className="finder-row" key={post.id}><span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span><div><h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p></div><time dateTime={post.occurredAt}>{post.occurredAt}</time><strong>{score.total}점</strong></article>` 평가 결과를 반환한다.
  // 선택 조건 `post.kind === "lost"`: 참이면 `"분실"`, 거짓이면 `"습득"`를 사용한다.
  // 단락 분기 `matches.length === 0`: 참인 경우에만 오른쪽 `<div className="empty-note">조건에 맞는 추천 후보가 없습니다.</div>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="subpage page-shell">
    <div className="subpage-heading"><div><p className="eyebrow">GWG FINDER</p><h1>추천 후보</h1><p>유사도는 비교 점수이며 소유권 증명이 아닙니다. 수령 전 비공개로 소유권을 확인하세요.</p></div><Link className="button" href="/finder">목록으로</Link></div>
    <div className="finder-list">{matches.map(({ post, score }) => <article className="finder-row" key={post.id}><span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span><div><h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p></div><time dateTime={post.occurredAt}>{post.occurredAt}</time><strong>{score.total}점</strong></article>)}</div>
    {matches.length === 0 && <div className="empty-note">조건에 맞는 추천 후보가 없습니다.</div>}
  </div>;
}
