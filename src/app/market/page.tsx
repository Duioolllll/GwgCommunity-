import Link from "next/link";

const products = [
  { title: "문제집 / 수학의 정석", category: "책·교재", price: "5,000원", status: "판매 중" },
  { title: "체육복 상의 100", category: "의류", price: "8,000원", status: "판매 중" },
  { title: "과학 실험 키트", category: "기타", price: "나눔", status: "나눔" },
];

export default function MarketPage() {
  return (
    <div className="subpage page-shell">
      <div className="subpage-heading">
        <div>
          <p className="eyebrow">GWG MARKET</p>
          <h1>교내 중고거래</h1>
          <p>필요한 물건을 찾고, 쓰지 않는 물건을 나눠보세요.</p>
        </div>
        <Link className="button button-dark" href="/market/new">글 작성하기 <span aria-hidden>↗</span></Link>
      </div>
      <div className="filter-row">
        <button className="filter-chip active">전체</button>
        <button className="filter-chip">책·교재</button>
        <button className="filter-chip">의류</button>
        <button className="filter-chip">전자기기</button>
        <button className="filter-chip">나눔</button>
      </div>
      <div className="listing-grid">
        {products.map((product) => (
          <article className="listing-card" key={product.title}>
            <div className="listing-image" aria-hidden />
            <div className="listing-content">
              <span className="card-label">{product.category}</span>
              <h2>{product.title}</h2>
              <div className="listing-meta"><strong>{product.price}</strong><span>{product.status}</span></div>
            </div>
          </article>
        ))}
      </div>
      <div className="empty-note">상품 상태는 서버에서 관리되며, 학생 로그인 후 새 상품을 등록하고 예약할 수 있습니다.</div>
    </div>
  );
}
