import Link from "next/link";
import { LoginForm } from "@/components/AuthForm";

// 로그인 처리는 재사용 폼에 맡기고 가입 화면 링크를 제공한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default function LoginPage() {
  return (
    <div className="auth-page page-shell">
      <div className="auth-card">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>다시 만나서 반가워요.</h1>
        <p>학생 계정으로 로그인하면 거래·지원·등록 기능을 이용할 수 있습니다.</p>
        <LoginForm />
        <p className="auth-footer">초대 코드가 있나요? <Link href="/auth/register">학생 가입하기</Link></p>
      </div>
    </div>
  );
}
