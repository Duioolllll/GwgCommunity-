import { headers } from "next/headers";
import Link from "next/link";
import { MarketForm } from "@/components/MarketForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
// 이메일 확인과 학생 인증을 마친 사용자에게만 상품 작성 폼을 표시한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function NewMarketPage() {
  const user = await getCurrentUser(await headers());
  // 확인할 조건: ((사용자 없음 또는 false) 또는 (사용자의 이메일 인증 여부 없음 또는 false)) 또는 (사용자의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / NEW</p><h1>학생 인증이 필요합니다.</h1><p>상품 등록은 이메일 확인과 초대 코드 인증을 마친 학생이 이용할 수 있습니다.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG MARKET / NEW</p><h1>상품 등록</h1><p>거래에 필요한 정보만 작성하고, 연락처는 공개하지 마세요.</p><MarketForm /><p className="auth-footer"><Link href="/market">← Market으로 돌아가기</Link></p>
  </div></div>;
}
