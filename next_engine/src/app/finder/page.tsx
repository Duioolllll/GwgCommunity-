/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import Image from "next/image";
import { visibleImages } from "@/lib/storage/attachments";
import { ServiceIcon } from "@/components/ServiceIcon";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listFinderPosts, parseFinderFilters } from "@/features/finder/posts";

// 유효한 필터와 열람자 식별자를 조회에 전달하고 화면에는 최대 20개를 표시한다.
// 기능 `FinderPage`({ searchParams }): 먼저 `const raw = await searchParams;`를 실행한다.
export default async function FinderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = new URLSearchParams();
  // 반복 `Object.entries(raw)`: 각 값를 `const [key, value]`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
  // 조건 `typeof value === "string"`: 참이면 먼저 `query.set(key, value);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") query.set(key, value);
  const filters = parseFinderFilters(query);
  const viewer = await getCurrentUser(await headers());
  // 선택 조건 `viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT"`: 참이면 `viewer.id`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  // 선택 조건 `filters`: 참이면 `await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters)`, 거짓이면 `[]`를 사용한다.
  const allPosts = filters ? await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters) : [];
  const posts = allPosts.slice(0, 20);
  // 기능 `콜백`(post): `post.id` 평가 결과를 반환한다.
  const images = await visibleImages(getDb(), "finder", posts.map(post => post.id), viewerId);
  // 기능 `pageLink`(page): 먼저 `const next = new URLSearchParams(query);`를 실행한다.
  const pageLink = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/finder?${next}`;
  };
  // 단락 분기 `filters?.kind`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters?.category`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters?.color`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters?.q`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!filters`: 참인 경우에만 오른쪽 `<p className="form-error">검색 조건을 확인해 주세요.</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(post): `<article className="finder-row" key={post.id}> <span className={`finder-kind ${post.kind}`}>{post.kind === "lost" ? "분실" : "습득"}</span> <div>{images.filter(image => image.finderPostId === post.id).map(image => <Image unoptimized key={image.id} src={`/api/media/${image.id}`} alt={`${post.title} 이미지`} width={100} height={100} style={{ objectFit: "contain" }} />)}<h2>{post.title}</h2><p>{post.category} · {post.color} · {post.generalLocation}</p>{post.isOwn && <Link className="finder-match-link" href={`/finder/${post.id}`}>내 글 관리 →</Link>}</div> <time dateTime={post.occurredAt}>{post.occurredAt}</time><span className="card-arrow" aria-hidden>↗</span> </article>` 평가 결과를 반환한다.
  // 선택 조건 `post.kind === "lost"`: 참이면 `"분실"`, 거짓이면 `"습득"`를 사용한다.
  // 기능 `콜백`(image): `image.finderPostId === post.id` 평가 결과를 반환한다.
  // 기능 `콜백`(image): `<Image unoptimized key={image.id} src={`/api/media/${image.id}`} alt={`${post.title} 이미지`} width={100} height={100} style={{ objectFit: "contain" }} />` 평가 결과를 반환한다.
  // 단락 분기 `post.isOwn`: 참인 경우에만 오른쪽 `<Link className="finder-match-link" href={`/finder/${post.id}`}>내 글 관리 →</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters && posts.length === 0`: 참인 경우에만 오른쪽 `<div className="empty-note">표시할 분실·습득물이 없습니다.</div>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters`: 참인 경우에만 오른쪽 `posts.length === 0`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters`: 참인 경우에만 오른쪽 `<nav className="finder-pagination" aria-label="분실물 목록 페이지">{filters.page > 1 && <Link href={pageLink(filters.page - 1)}>← 이전</Link>}<span>{filters.page} 페이지</span>{allPosts.length > 20 && filters.page < 10000 && <Link href={pageLink(filters.page + 1)}>다음 →</Link>}</nav>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `filters.page > 1`: 참인 경우에만 오른쪽 `<Link href={pageLink(filters.page - 1)}>← 이전</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `allPosts.length > 20 && filters.page < 10000`: 참인 경우에만 오른쪽 `<Link href={pageLink(filters.page + 1)}>다음 →</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `allPosts.length > 20`: 참인 경우에만 오른쪽 `filters.page < 10000`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
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
