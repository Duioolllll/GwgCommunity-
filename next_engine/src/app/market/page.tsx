/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { visibleImages } from "@/lib/storage/attachments";
import { ServiceIcon } from "@/components/ServiceIcon";
import { categories, listMarketPosts, marketStatusLabels, parseFilters, type MarketFilters } from "@/features/market/data";

export const dynamic = "force-dynamic";
// 검색 조건과 페이지를 유지하며 열람 가능한 이미지 중 게시물별 첫 이미지를 표지로 쓴다.
// 기능 `MarketPage`({ searchParams }): 먼저 `const filters = parseFilters(await searchParams);`를 실행한다.
export default async function MarketPage({ searchParams }: { searchParams: Promise<MarketFilters> }) {
  const filters = parseFilters(await searchParams);
  const { posts, hasNext } = await listMarketPosts(getDb(), { ...filters, minPrice: filters.minPrice?.toString(), maxPrice: filters.maxPrice?.toString(), page: String(filters.page) });
  const viewer = await getCurrentUser(await headers());
  // 선택 조건 `viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT"`: 참이면 `viewer.id`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  // 기능 `콜백`(post): `post.id` 평가 결과를 반환한다.
  const images = await visibleImages(getDb(), "market", posts.map(post => post.id), viewerId);
  const coverByPost = new Map<string, string>();
  // 반복 `images`: 각 값를 `const image`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
  // 조건 `image.marketPostId && !coverByPost.has(image.marketPostId)`: 참이면 먼저 `coverByPost.set(image.marketPostId, image.id);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `image.marketPostId`: 참인 경우에만 오른쪽 `!coverByPost.has(image.marketPostId)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  for (const image of images) if (image.marketPostId && !coverByPost.has(image.marketPostId)) coverByPost.set(image.marketPostId, image.id);
  // 기능 `pageHref`(page): 먼저 `const query = new URLSearchParams();`를 실행한다.
  function pageHref(page: number) {
    const query = new URLSearchParams();
    // 조건 `filters.q`: 참이면 먼저 `query.set("q", filters.q);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.q) query.set("q", filters.q);
    // 조건 `filters.category`: 참이면 먼저 `query.set("category", filters.category);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.category) query.set("category", filters.category);
    // 조건 `filters.status`: 참이면 먼저 `query.set("status", filters.status);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.status) query.set("status", filters.status);
    // 조건 `filters.minPrice !== undefined`: 참이면 먼저 `query.set("minPrice", String(filters.minPrice));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.minPrice !== undefined) query.set("minPrice", String(filters.minPrice));
    // 조건 `filters.maxPrice !== undefined`: 참이면 먼저 `query.set("maxPrice", String(filters.maxPrice));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (filters.maxPrice !== undefined) query.set("maxPrice", String(filters.maxPrice));
    query.set("page", String(page));
    return `/market?${query}`;
  }
  // 기능 `콜백`(category): `<option key={category}>{category}</option>` 평가 결과를 반환한다.
  // 기능 `콜백`([value, label]): `<option key={value} value={value}>{label}</option>` 평가 결과를 반환한다.
  // 선택 조건 `posts.length`: 참이면 `<div className="listing-grid">{posts.map((post) => <Link className="listing-card" href={`/market/${post.id}`} key={post.id}> <div className="listing-image" aria-hidden>{coverByPost.has(post.id) && <Image unoptimized src={`/api/media/${coverByPost.get(post.id)}`} alt="" width={400} height={225} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div><div className="listing-content"><span className="card-label">{post.category}</span><h2>{post.title}</h2><div className="listing-meta"><strong>{post.price === 0 ? "나눔" : `${post.price.toLocaleString("ko-KR")}원`}</strong><span>{marketStatusLabels[post.status]}</span></div></div> </Link>)}</div>`, 거짓이면 `<p className="empty-note">조건에 맞는 상품이 없습니다. 검색 조건을 바꾸거나 첫 상품을 등록해 보세요.</p>`를 사용한다.
  // 기능 `콜백`(post): `<Link className="listing-card" href={`/market/${post.id}`} key={post.id}> <div className="listing-image" aria-hidden>{coverByPost.has(post.id) && <Image unoptimized src={`/api/media/${coverByPost.get(post.id)}`} alt="" width={400} height={225} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div><div className="listing-content"><span className="card-label">{post.category}</span><h2>{post.title}</h2><div className="listing-meta"><strong>{post.price === 0 ? "나눔" : `${post.price.toLocaleString("ko-KR")}원`}</strong><span>{marketStatusLabels[post.status]}</span></div></div> </Link>` 평가 결과를 반환한다.
  // 단락 분기 `coverByPost.has(post.id)`: 참인 경우에만 오른쪽 `<Image unoptimized src={`/api/media/${coverByPost.get(post.id)}`} alt="" width={400} height={225} style={{ width: "100%", height: "100%", objectFit: "cover" }} />`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `post.price === 0`: 참이면 `"나눔"`, 거짓이면 ``${post.price.toLocaleString("ko-KR")}원``를 사용한다.
  // 단락 분기 `filters.page > 1`: 참인 경우에만 오른쪽 `<Link href={pageHref(filters.page - 1)}>← 이전</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `hasNext`: 참인 경우에만 오른쪽 `<Link href={pageHref(filters.page + 1)}>다음 →</Link>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="subpage page-shell">
    <div className="subpage-heading"><div><p className="eyebrow service-eyebrow"><span className="service-heading-icon"><ServiceIcon kind="market" /></span>GWG MARKET</p><h1>교내 중고거래</h1><p>필요한 물건을 찾고, 쓰지 않는 물건을 나눠보세요.</p></div><Link className="button button-dark" href="/market/new">글 작성하기 <span aria-hidden>↗</span></Link></div>
    <form className="market-filters" action="/market">
      <label>검색<input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="상품명 검색" /></label>
      <label>카테고리<select name="category" defaultValue={filters.category}><option value="">전체</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>상태<select name="status" defaultValue={filters.status}><option value="">전체</option>{Object.entries(marketStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>최소 가격<input name="minPrice" type="number" min="0" max="100000000" defaultValue={filters.minPrice} placeholder="0원" /></label>
      <label>최대 가격<input name="maxPrice" type="number" min="0" max="100000000" defaultValue={filters.maxPrice} placeholder="제한 없음" /></label>
      <button className="button button-dark" type="submit">검색</button>
    </form>
    {posts.length ? <div className="listing-grid">{posts.map((post) => <Link className="listing-card" href={`/market/${post.id}`} key={post.id}>
      <div className="listing-image" aria-hidden>{coverByPost.has(post.id) && <Image unoptimized src={`/api/media/${coverByPost.get(post.id)}`} alt="" width={400} height={225} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div><div className="listing-content"><span className="card-label">{post.category}</span><h2>{post.title}</h2><div className="listing-meta"><strong>{post.price === 0 ? "나눔" : `${post.price.toLocaleString("ko-KR")}원`}</strong><span>{marketStatusLabels[post.status]}</span></div></div>
    </Link>)}</div> : <p className="empty-note">조건에 맞는 상품이 없습니다. 검색 조건을 바꾸거나 첫 상품을 등록해 보세요.</p>}
    <nav className="market-pagination" aria-label="상품 목록 페이지">{filters.page > 1 && <Link href={pageHref(filters.page - 1)}>← 이전</Link>}<span>{filters.page} 페이지</span>{hasNext && <Link href={pageHref(filters.page + 1)}>다음 →</Link>}</nav>
  </div>;
}
