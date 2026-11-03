import Link from "next/link";
import { LoginForm } from "@/components/AuthForm";

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
