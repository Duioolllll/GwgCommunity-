/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import Link from "next/link";
import { MarketForm } from "@/components/MarketForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
// 이메일 확인과 학생 인증을 마친 사용자에게만 상품 작성 폼을 표시한다.
// 기능 `NewMarketPage`(): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export default async function NewMarketPage() {
  const user = await getCurrentUser(await headers());
  // 조건 `!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / NEW</p><h1>학생 인증이 필요합니다.</h1><p>상품 등록은 이메일 확인과 초대 코드 인증을 마친 학생이 이용할 수 있습니다.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user || !user.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!user`: 거짓인 경우에만 오른쪽 `!user.emailVerified`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user || !user.emailVerified || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">GWG MARKET / NEW</p><h1>학생 인증이 필요합니다.</h1><p>상품 등록은 이메일 확인과 초대 코드 인증을 마친 학생이 이용할 수 있습니다.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>;
  return <div className="auth-page page-shell"><div className="auth-card">
    <p className="eyebrow">GWG MARKET / NEW</p><h1>상품 등록</h1><p>거래에 필요한 정보만 작성하고, 연락처는 공개하지 마세요.</p><MarketForm /><p className="auth-footer"><Link href="/market">← Market으로 돌아가기</Link></p>
  </div></div>;
}
