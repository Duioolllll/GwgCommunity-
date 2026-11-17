import Link from "next/link";
import { listClubs } from "./data";
import { ServiceIcon } from "@/components/ServiceIcon";

export const dynamic = "force-dynamic";

// 공개 목록 최대 100개를 가져온 뒤 검색어·분류·모집 여부를 화면에서 필터링한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ recruiting?: string | string[]; q?: string | string[]; category?: string | string[] }> }) {
  const raw = await searchParams;
  // 같은 검색 항목이 여러 번 왔을 때 첫 번째 값만 사용한다.
  // 선택 기준: 입력값이 목록임 있음 또는 true. 맞으면 입력값에서 0에 해당하는 값을 사용하고, 아니면 입력값을 사용한다.
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = { recruiting: first(raw.recruiting), q: first(raw.q), category: first(raw.category) };
  const recruitingOnly = filters.recruiting === "1";
  // 검색 조건의 검색어이 비어 있으면 빈 글자를 대신 사용한다.
  const q = (filters.q ?? "").trim().toLocaleLowerCase();
  // 두 글에 분류 정보가 있고 서로 같으면 40점, 그 외에는 0점이다.
  const category = (filters.category ?? "").trim();
  const all = await listClubs();
  // 이 조건에 맞는 항목만 목록에 남긴다.
  // 아님(recruitingOnly)이 없거나 조건에 맞지 않을 때 동아리의 recruiting을 대신 사용한다.
  // 아님(검색어)이 없거나 조건에 맞지 않을 때 표기를 통일한 필요한 값을 넣어 만든 글자에 검색어이 포함됨을 대신 사용한다.
  const clubs = all.filter((club) => (!recruitingOnly || club.recruiting) && (!category || club.category === category) && (!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q)));
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  const categories = [...new Set(all.map((club) => club.category))];
  // 선택한 검색 조건을 유지하면서 다른 필터로 이동할 주소를 만든다.
  function filterHref(recruiting: boolean) {
    const query = new URLSearchParams();
    // 확인할 조건: 표기를 통일한 검색 조건의 검색어 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.q?.trim()) query.set("q", filters.q.trim());
    // 확인할 조건: 분류 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (category) query.set("category", category);
    // 확인할 조건: recruiting 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (recruiting) query.set("recruiting", "1");
    // 선택 기준: query의 크기 있음 또는 true. 맞으면 필요한 값을 넣어 만든 글자를 사용하고, 아니면 “/clubs” 값을 사용한다.
    return query.size ? `/clubs?${query}` : "/clubs";
  }
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: recruitingOnly 없음 또는 false. 맞으면 “ active” 값을 사용하고, 아니면 빈 글자를 사용한다.
  // 선택 기준: recruitingOnly 없음 또는 false. 맞으면 “page” 값을 사용하고, 아니면 undefined를 사용한다.
  // 선택 기준: recruitingOnly 있음 또는 true. 맞으면 “ active” 값을 사용하고, 아니면 빈 글자를 사용한다.
  // 선택 기준: recruitingOnly 있음 또는 true. 맞으면 “page” 값을 사용하고, 아니면 undefined를 사용한다.
  // 선택 기준: 동아리의 recruiting 있음 또는 true. 맞으면 해당 화면을 사용하고, 아니면 해당 화면을 사용한다.
  // 선택 기준: recruitingOnly 있음 또는 true. 맞으면 “현재 모집 중인 동아리가 없습니다.” 값을 사용하고, 아니면 “아직 공개된 동아리가 없습니다.” 값을 사용한다.
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
