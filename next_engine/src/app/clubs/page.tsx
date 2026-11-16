/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { listClubs } from "./data";
import { ServiceIcon } from "@/components/ServiceIcon";

export const dynamic = "force-dynamic";

// 공개 목록 최대 100개를 가져온 뒤 검색어·분류·모집 여부를 화면에서 필터링한다.
// 기능 `ClubsPage`({ searchParams }): 먼저 `const raw = await searchParams;`를 실행한다.
export default async function ClubsPage({ searchParams }: { searchParams: Promise<{ recruiting?: string | string[]; q?: string | string[]; category?: string | string[] }> }) {
  const raw = await searchParams;
  // 기능 `first`(value): `Array.isArray(value) ? value[0] : value` 평가 결과를 반환한다.
  // 선택 조건 `Array.isArray(value)`: 참이면 `value[0]`, 거짓이면 `value`를 사용한다.
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = { recruiting: first(raw.recruiting), q: first(raw.q), category: first(raw.category) };
  const recruitingOnly = filters.recruiting === "1";
  // 단락 분기 `filters.q`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const q = (filters.q ?? "").trim().toLocaleLowerCase();
  // 단락 분기 `filters.category`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const category = (filters.category ?? "").trim();
  const all = await listClubs();
  // 기능 `콜백`(club): `(!recruitingOnly || club.recruiting) && (!category || club.category === category) && (!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q))` 평가 결과를 반환한다.
  // 단락 분기 `(!recruitingOnly || club.recruiting) && (!category || club.category === category)`: 참인 경우에만 오른쪽 `(!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q))`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `(!recruitingOnly || club.recruiting)`: 참인 경우에만 오른쪽 `(!category || club.category === category)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!recruitingOnly`: 거짓인 경우에만 오른쪽 `club.recruiting`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!category`: 거짓인 경우에만 오른쪽 `club.category === category`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!q`: 거짓인 경우에만 오른쪽 ``${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const clubs = all.filter((club) => (!recruitingOnly || club.recruiting) && (!category || club.category === category) && (!q || `${club.name} ${club.introduction} ${club.category}`.toLocaleLowerCase().includes(q)));
  // 기능 `콜백`(club): `club.category` 평가 결과를 반환한다.
  const categories = [...new Set(all.map((club) => club.category))];
  // 기능 `filterHref`(recruiting): 먼저 `const query = new URLSearchParams();`를 실행한다.
  function filterHref(recruiting: boolean) {
    const query = new URLSearchParams();
    // 조건 `filters.q?.trim()`: 참이면 먼저 `query.set("q", filters.q.trim());`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.q?.trim()) query.set("q", filters.q.trim());
    // 조건 `category`: 참이면 먼저 `query.set("category", category);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (category) query.set("category", category);
    // 조건 `recruiting`: 참이면 먼저 `query.set("recruiting", "1");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (recruiting) query.set("recruiting", "1");
    // 선택 조건 `query.size`: 참이면 ``/clubs?${query}``, 거짓이면 `"/clubs"`를 사용한다.
    return query.size ? `/clubs?${query}` : "/clubs";
  }
  // 기능 `콜백`(value): `<option key={value} value={value}>{value}</option>` 평가 결과를 반환한다.
  // 선택 조건 `!recruitingOnly`: 참이면 `" active"`, 거짓이면 `""`를 사용한다.
  // 선택 조건 `!recruitingOnly`: 참이면 `"page"`, 거짓이면 `undefined`를 사용한다.
  // 선택 조건 `recruitingOnly`: 참이면 `" active"`, 거짓이면 `""`를 사용한다.
  // 선택 조건 `recruitingOnly`: 참이면 `"page"`, 거짓이면 `undefined`를 사용한다.
  // 기능 `콜백`(club): `<Link className="club-row" key={club.id} href={`/clubs/${encodeURIComponent(club.slug)}`}> <div className="club-avatar" aria-hidden>{club.name.charAt(0)}</div><div className="club-info"><span className="card-label">{club.category}</span><h2>{club.name}</h2><p>{club.introduction}</p></div><div className="club-status">{club.recruiting ? <span className="status-open">모집 중</span> : <span>모집 예정</span>}</div><span className="card-arrow" aria-hidden>↗</span> </Link>` 평가 결과를 반환한다.
  // 선택 조건 `club.recruiting`: 참이면 `<span className="status-open">모집 중</span>`, 거짓이면 `<span>모집 예정</span>`를 사용한다.
  // 단락 분기 `clubs.length === 0`: 참인 경우에만 오른쪽 `<p className="empty-note">{recruitingOnly ? "현재 모집 중인 동아리가 없습니다." : "아직 공개된 동아리가 없습니다."}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `recruitingOnly`: 참이면 `"현재 모집 중인 동아리가 없습니다."`, 거짓이면 `"아직 공개된 동아리가 없습니다."`를 사용한다.
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
