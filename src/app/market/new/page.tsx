import Link from "next/link";
import { MarketForm } from "@/components/MarketForm";

export default function NewMarketPage() {
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG MARKET / NEW</p>
    <h1>상품 등록</h1>
    <p>거래에 필요한 정보만 작성하고, 연락처는 공개하지 마세요.</p>
    <MarketForm />
    <p className="auth-footer"><Link href="/market">← Market으로 돌아가기</Link></p>
  </div></div>;
}
