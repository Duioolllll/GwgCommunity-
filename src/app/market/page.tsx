import Link from "next/link";
import { getDb } from "@/lib/db";
import { categories, listMarketPosts, marketStatusLabels, parseFilters, type MarketFilters } from "@/features/market/data";

export const dynamic = "force-dynamic";
export default async function MarketPage({ searchParams }: { searchParams: Promise<MarketFilters> }) {
  const filters = parseFilters(await searchParams);
  const { posts, hasNext } = await listMarketPosts(getDb(), { ...filters, minPrice: filters.minPrice?.toString(), maxPrice: filters.maxPrice?.toString(), page: String(filters.page) });
  function pageHref(page: number) {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category) query.set("category", filters.category);
    if (filters.status) query.set("status", filters.status);
    if (filters.minPrice !== undefined) query.set("minPrice", String(filters.minPrice));
    if (filters.maxPrice !== undefined) query.set("maxPrice", String(filters.maxPrice));
    query.set("page", String(page));
    return `/market?${query}`;
  }
  return <div className="subpage page-shell">
    <div className="subpage-heading"><div><p className="eyebrow">GWG MARKET</p><h1>교내 중고거래</h1><p>필요한 물건을 찾고, 쓰지 않는 물건을 나눠보세요.</p></div><Link className="button button-dark" href="/market/new">글 작성하기 <span aria-hidden>↗</span></Link></div>
    <form className="market-filters" action="/market">
      <label>검색<input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="상품명 검색" /></label>
      <label>카테고리<select name="category" defaultValue={filters.category}><option value="">전체</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>상태<select name="status" defaultValue={filters.status}><option value="">전체</option>{Object.entries(marketStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>최소 가격<input name="minPrice" type="number" min="0" max="100000000" defaultValue={filters.minPrice} placeholder="0원" /></label>
      <label>최대 가격<input name="maxPrice" type="number" min="0" max="100000000" defaultValue={filters.maxPrice} placeholder="제한 없음" /></label>
      <button className="button button-dark" type="submit">검색</button>
    </form>
    {posts.length ? <div className="listing-grid">{posts.map((post) => <Link className="listing-card" href={`/market/${post.id}`} key={post.id}>
      <div className="listing-image" aria-hidden /><div className="listing-content"><span className="card-label">{post.category}</span><h2>{post.title}</h2><div className="listing-meta"><strong>{post.price === 0 ? "나눔" : `${post.price.toLocaleString("ko-KR")}원`}</strong><span>{marketStatusLabels[post.status]}</span></div></div>
    </Link>)}</div> : <p className="empty-note">조건에 맞는 상품이 없습니다. 검색 조건을 바꾸거나 첫 상품을 등록해 보세요.</p>}
    <nav className="market-pagination" aria-label="상품 목록 페이지">{filters.page > 1 && <Link href={pageHref(filters.page - 1)}>← 이전</Link>}<span>{filters.page} 페이지</span>{hasNext && <Link href={pageHref(filters.page + 1)}>다음 →</Link>}</nav>
  </div>;
}
