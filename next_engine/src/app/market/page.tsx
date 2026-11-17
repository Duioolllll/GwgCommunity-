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
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function MarketPage({ searchParams }: { searchParams: Promise<MarketFilters> }) {
  const filters = parseFilters(await searchParams);
  const { posts, hasNext } = await listMarketPosts(getDb(), { ...filters, minPrice: filters.minPrice?.toString(), maxPrice: filters.maxPrice?.toString(), page: String(filters.page) });
  const viewer = await getCurrentUser(await headers());
  // 선택 기준: (viewer의 이메일 인증 여부 있음 또는 true) 그리고 (viewer의 상태 = “인증된 학생”). 맞으면 viewer의 고유 번호를 사용하고, 아니면 undefined를 사용한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  const images = await visibleImages(getDb(), "market", posts.map(post => post.id), viewerId);
  const coverByPost = new Map<string, string>();
  // 이미지 목록의 항목을 하나씩 꺼내 아래 작업을 반복한다. 항목이 없으면 건너뛴다.
  // 확인할 조건: (이미지의 marketPostId 있음 또는 true) 그리고 (coverByPost에 이미지의 marketPostId이 포함됨 조건을 만족하지 않음). 해당하면 아래에 있는 작업을 실행한다.
  for (const image of images) if (image.marketPostId && !coverByPost.has(image.marketPostId)) coverByPost.set(image.marketPostId, image.id);
  // pageHref 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  function pageHref(page: number) {
    const query = new URLSearchParams();
    // 확인할 조건: 검색 조건의 검색어 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.q) query.set("q", filters.q);
    // 확인할 조건: 검색 조건의 분류 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.category) query.set("category", filters.category);
    // 확인할 조건: 검색 조건의 상태 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.status) query.set("status", filters.status);
    // 확인할 조건: 검색 조건의 minPrice ≠ undefined. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.minPrice !== undefined) query.set("minPrice", String(filters.minPrice));
    // 확인할 조건: 검색 조건의 maxPrice ≠ undefined. 해당하면 아래에 있는 작업을 실행한다.
    if (filters.maxPrice !== undefined) query.set("maxPrice", String(filters.maxPrice));
    query.set("page", String(page));
    return `/market?${query}`;
  }
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: 게시글 목록의 개수 또는 길이 있음 또는 true. 맞으면 해당 화면을 사용하고, 아니면 해당 화면을 사용한다.
  // coverByPost에 게시글의 고유 번호이 포함됨이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 게시글의 가격 = 0. 맞으면 “나눔” 값을 사용하고, 아니면 필요한 값을 넣어 만든 글자를 사용한다.
  // hasNext이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
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
