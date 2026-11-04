import Link from "next/link";
import Image from "next/image";
import { visibleImages } from "@/lib/storage/attachments";
import { ServiceIcon } from "@/components/ServiceIcon";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listFinderPosts, parseFinderFilters } from "@/features/finder/posts";

export default async function FinderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") query.set(key, value);
  const filters = parseFinderFilters(query);
  const viewer = await getCurrentUser(await headers());
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const allPosts = filters ? await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters) : [];
  const posts = allPosts.slice(0, 20);
  const images = await visibleImages(getDb(), "finder", posts.map(post => post.id), viewerId);
  const pageLink = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/finder?${next}`;
  };
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading">
        <div><p className="eyebrow service-eyebrow"><span className="service-heading-icon"><ServiceIcon kind="finder" /></span>GWG FINDER</p><h1>분실물 찾기</h1><p>잃어버린 물건과 습득물을 안전하게 연결합니다.</p></div>
        <Link className="button button-dark" href="/finder/new">등록하기 <span aria-hidden>↗</span></Link>
      </div>
      <div className="finder-banner"><strong>물건을 찾고 있나요?</strong><span>정확한 위치와 연락처는 공개하지 않습니다. 소유권은 비공개로 확인합니다.</span></div>
      <form className="finder-filters" action="/finder">
        <label>유형<select name="kind" defaultValue={filters?.kind ?? ""}><option value="">전체</option><option value="lost">분실</option><option value="found">습득</option></select></label>
        <label>분류<input name="category" maxLength={50} defaultValue={filters?.category ?? ""} placeholder="예: 문구" /></label>
        <label>색상<input name="color" maxLength={50} defaultValue={filters?.color ?? ""} placeholder="예: 검정" /></label>
        <label>물건 검색<input name="q" maxLength={120} defaultValue={filters?.q ?? ""} placeholder="물건 이름" /></label>
        <button className="button button-dark" type="submit">검색</button><Link className="button" href="/finder">초기화</Link>
      </form>
      {!filters && <p className="form-error">검색 조건을 확인해 주세요.</p>}
      <div className="finder-list">
        {posts.map(post => <article className="finder-row" key={post.id}>
          <span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span>
          <div>{images.filter(image => image.finderPostId === post.id).map(image => <Image unoptimized key={image.id} src={`/api/media/${image.id}`} alt={`${post.title} 이미지`} width={100} height={100} style={{ objectFit: "contain" }} />)}<h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p>{post.isOwn && <Link className="finder-match-link" href={`/finder/${post.id}`}>내 글 관리 →</Link>}</div>
          <time dateTime={post.occurredAt}>{post.occurredAt}</time><span className="card-arrow" aria-hidden>↗</span>
        </article>)}
      </div>
      {filters && posts.length === 0 && <div className="empty-note">표시할 분실·습득물이 없습니다.</div>}
      {filters && <nav className="finder-pagination" aria-label="분실물 목록 페이지">{filters.page > 1 && <Link href={pageLink(filters.page - 1)}>← 이전</Link>}<span>{filters.page} 페이지</span>{allPosts.length > 20 && filters.page < 10000 && <Link href={pageLink(filters.page + 1)}>다음 →</Link>}</nav>}
      <div className="empty-note">분실·습득물 등록과 유사 물건 추천은 학생 인증 후 이용할 수 있습니다.</div>
    </div>
  );
}
