import Link from "next/link";
import { RegisterForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <div className="auth-page page-shell">
      <div className="auth-card">
        <p className="eyebrow">STUDENT ACCESS</p>
        <h1>초대 코드로 시작하세요.</h1>
        <p>광덕고 학생에게 발급된 1회용 코드가 필요합니다.</p>
        <RegisterForm />
        <p className="auth-footer">이미 계정이 있나요? <Link href="/auth/login">로그인하기</Link></p>
      </div>
    </div>
  );
}
