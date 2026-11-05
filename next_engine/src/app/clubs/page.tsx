import Link from "next/link";
import { listClubs } from "./data";
import { ServiceIcon } from "@/components/ServiceIcon";

export const dynamic = "force-dynamic";

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ recruiting?: string | string[]; q?: string | string[]; category?: string | string[] }> }) {
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = { recruiting: first(raw.recruiting), q: first(raw.q), category: first(raw.category) };
  const recruitingOnly = filters.recruiting === "1";
  const q = (filters.q ?? "").trim().toLocaleLowerCase();
  const category = (filters.category ?? "").trim();
  const all = await listClubs();
  const clubs = all.filter((club) => (!recruitingOnly || club.recruiting) && (!category || club.category === category) && (!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q)));
  const categories = [...new Set(all.map((club) => club.category))];
  function filterHref(recruiting: boolean) {
    const query = new URLSearchParams();
    if (filters.q?.trim()) query.set("q", filters.q.trim());
    if (category) query.set("category", category);
    if (recruiting) query.set("recruiting", "1");
    return query.size ? `/clubs?${query}` : "/clubs";
  }
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading"><div><p className="eyebrow service-eyebrow"><span className="service-heading-icon"><ServiceIcon kind="clubs" /></span>GWG CLUBS</p><h1>동아리와 활동</h1><p>광덕고에서 진행되는 다양한 활동을 발견해보세요.</p></div><Link className="text-link" href="/auth/login">운영자 로그인 <span aria-hidden>↗</span></Link></div>
      <form className="club-filters" action="/clubs">
        <label className="club-search-field">동아리 검색<input name="q" type="search" defaultValue={filters.q} placeholder="동아리 이름이나 활동 검색" /></label>
        <label className="club-category-field">분류<select name="category" defaultValue={category}><option value="">전체</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="club-checkbox"><input type="checkbox" name="recruiting" value="1" defaultChecked={recruitingOnly} /><span>모집 중만 보기</span></label>
        <button className="button button-dark" type="submit">검색</button>
      </form>
      <nav className="filter-row" aria-label="동아리 필터">
        <Link className={`filter-chip${!recruitingOnly ? " active" : ""}`} aria-current={!recruitingOnly ? "page" : undefined} href={filterHref(false)}>전체 동아리</Link>
        <Link className={`filter-chip${recruitingOnly ? " active" : ""}`} aria-current={recruitingOnly ? "page" : undefined} href={filterHref(true)}>모집 중</Link>
      </nav>
      <div className="club-list">
        {clubs.map((club) => <Link className="club-row" key={club.id} href={`/clubs/${encodeURIComponent(club.slug)}`}>
          <div className="club-avatar" aria-hidden>{club.name.charAt(0)}</div><div className="club-info"><span className="card-label">{club.category}</span><h2>{club.name}</h2><p>{club.introduction}</p></div><div className="club-status">{club.recruiting ? <span className="status-open">모집 중</span> : <span>모집 예정</span>}</div><span className="card-arrow" aria-hidden>↗</span>
        </Link>)}
      </div>
      {clubs.length === 0 && <p className="empty-note">{recruitingOnly ? "현재 모집 중인 동아리가 없습니다." : "아직 공개된 동아리가 없습니다."}</p>}
    </div>
  );
}
