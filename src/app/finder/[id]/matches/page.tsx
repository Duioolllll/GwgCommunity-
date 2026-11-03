import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

export default async function FinderMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const viewer = await getCurrentUser(await headers());
  if (!viewer || !viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return <div className="page-shell subpage"><h1>학생 인증이 필요합니다</h1><p>추천 후보는 인증된 작성자가 확인할 수 있습니다.</p><Link href="/auth/login">로그인</Link></div>;
  let matches;
  try { matches = await getFinderMatches(getDb(), id, viewer.id); }
  catch (error) { if (error instanceof FinderMatchError) notFound(); throw error; }
  return <div className="subpage page-shell">
    <div className="subpage-heading"><div><p className="eyebrow">GWG FINDER</p><h1>추천 후보</h1><p>유사도는 비교 점수이며 소유권 증명이 아닙니다. 수령 전 비공개로 소유권을 확인하세요.</p></div><Link className="button" href="/finder">목록으로</Link></div>
    <div className="finder-list">{matches.map(({ post, score }) => <article className="finder-row" key={post.id}><span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span><div><h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p></div><time dateTime={post.occurredAt}>{post.occurredAt}</time><strong>{score.total}점</strong></article>)}</div>
    {matches.length === 0 && <div className="empty-note">조건에 맞는 추천 후보가 없습니다.</div>}
  </div>;
}
