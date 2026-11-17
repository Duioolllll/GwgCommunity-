import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

// 추천 불러오기는 서비스에 작성자 ID를 전달하고 접근 오류는 찾을 수 없음으로 표시한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function FinderMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 아래에 있는 작업을 실행한다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: ((viewer 없음 또는 false) 또는 (viewer의 이메일 인증 여부 없음 또는 false)) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="page-shell subpage"><h1>학생 인증이 필요합니다</h1><p>추천 후보는 인증된 작성자가 확인할 수 있습니다.</p><Link href="/auth/login">로그인</Link></div>;
  let matches;
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  // 확인할 조건: 오류가 FinderMatchError 종류. 해당하면 아래에 있는 작업을 실행한다.
  try { matches = await getFinderMatches(getDb(), id, viewer.id); }
  catch (error) { if (error instanceof FinderMatchError) notFound(); throw error; }
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: 게시글의 분실·습득 종류 = “분실”. 맞으면 “분실” 값을 사용하고, 아니면 “습득” 값을 사용한다.
  return <div className="subpage page-shell">
    <div className="subpage-heading"><div><p className="eyebrow">GWG FINDER</p><h1>추천 후보</h1><p>유사도는 비교 점수이며 소유권 증명이 아닙니다. 수령 전 비공개로 소유권을 확인하세요.</p></div><Link className="button" href="/finder">목록으로</Link></div>
    <div className="finder-list">{matches.map(({ post, score }) => <article className="finder-row" key={post.id}><span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span><div><h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p></div><time dateTime={post.occurredAt}>{post.occurredAt}</time><strong>{score.total}점</strong></article>)}</div>
    {matches.length === 0 && <div className="empty-note">조건에 맞는 추천 후보가 없습니다.</div>}
  </div>;
}
