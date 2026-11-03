import Link from "next/link";
import { listClubs } from "./data";

export const dynamic = "force-dynamic";

export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ recruiting?: string; q?: string; category?: string }> }) {
  const filters = await searchParams;
  const recruitingOnly = filters.recruiting === "1";
  const q = (filters.q ?? "").trim().toLocaleLowerCase();
  const category = (filters.category ?? "").trim();
  const all = await listClubs();
  const clubs = all.filter((club) => (!recruitingOnly || club.recruiting) && (!category || club.category === category) && (!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q)));
  const categories = [...new Set(all.map((club) => club.category))];
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading"><div><p className="eyebrow">GWG CLUBS</p><h1>동아리와 활동</h1><p>광덕고에서 진행되는 다양한 활동을 발견해보세요.</p></div><Link className="text-link" href="/auth/login">운영자 로그인 <span aria-hidden>↗</span></Link></div>
      <form className="filter-row" action="/clubs"><label>동아리 검색 <input name="q" defaultValue={filters.q} /></label><label>분류 <select name="category" defaultValue={category}><option value="">전체</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label><input type="checkbox" name="recruiting" value="1" defaultChecked={recruitingOnly} /> 모집 중</label><button className="button button-dark">검색</button></form>
      <nav className="filter-row" aria-label="동아리 필터">
        <Link className={`filter-chip${!recruitingOnly ? " active" : ""}`} aria-current={!recruitingOnly ? "page" : undefined} href="/clubs">전체 동아리</Link>
        <Link className={`filter-chip${recruitingOnly ? " active" : ""}`} aria-current={recruitingOnly ? "page" : undefined} href="/clubs?recruiting=1">모집 중</Link>
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
