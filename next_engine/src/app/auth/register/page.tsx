/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import Link from "next/link";
import { RegisterForm } from "@/components/AuthForm";

// 가입 입력은 재사용 폼에서 처리하며 로그인 경로도 안내한다.
// 기능 `RegisterPage`(): `( <div className="auth-page page-shell"> <div className="auth-card"> <p className="eyebrow">STUDENT ACCESS</p> <h1>초대 코드로 시작하세요.</h1> <p>광덕고 학생에게 발급된 1회용 코드가 필요합니다.</p> <RegisterForm /> <p className="auth-footer">이미 계정이 있나요? <Link href="/auth/login">로그인하기</Link></p> </div> </div> )`를 반환한다.
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
