/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

// 기능 `LoginForm`(): 먼저 `const router = useRouter();`를 실행한다.
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("서버에 연결할 수 없습니다. 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      // 조건 `!response.ok`: 참이면 먼저 `setError("로그인할 수 없습니다. 이메일과 비밀번호 또는 이메일 확인 여부를 확인하세요.");`를 실행한다. 거짓이면 먼저 `router.push("/me");`를 실행한다.
      if (!response.ok) setError("로그인할 수 없습니다. 이메일과 비밀번호 또는 이메일 확인 여부를 확인하세요.");
      else { router.push("/me"); router.refresh(); }
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `busy`: 참이면 `"로그인 중…"`, 거짓이면 `"로그인"`를 사용한다.
  return <form className="auth-form" onSubmit={submit}>
    <label>이메일<input name="email" type="email" autoComplete="email" required placeholder="student@example.com" /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" required placeholder="비밀번호 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "로그인 중…" : "로그인"}</button>
  </form>;
}

// 가입 요청은 확인 메일을 안내하며 학생 인증은 로그인 후 별도로 진행한다.
// 기능 `RegisterForm`(): 먼저 `const [message, setMessage] = useState("");`를 실행한다.
export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setMessage("서버에 연결할 수 없습니다. 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      const response = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("nickname"), email: form.get("email"), password: form.get("password"), callbackURL: "/auth/login" }) });
      // 선택 조건 `response.ok`: 참이면 `"확인 메일을 보냈습니다. 메일의 링크로 이메일을 확인하고 로그인해 주세요."`, 거짓이면 `"가입을 완료할 수 없습니다. 입력 내용을 확인하고 다시 시도하세요."`를 사용한다.
      setMessage(response.ok ? "확인 메일을 보냈습니다. 메일의 링크로 이메일을 확인하고 로그인해 주세요." : "가입을 완료할 수 없습니다. 입력 내용을 확인하고 다시 시도하세요.");
    } catch { setMessage("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 단락 분기 `message`: 참인 경우에만 오른쪽 `<p role="status">{message}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `busy`: 참이면 `"가입 중…"`, 거짓이면 `"가입하기"`를 사용한다.
  return <form className="auth-form" onSubmit={submit}>
    <p>이메일 확인과 로그인 후 초대 코드를 입력합니다.</p>
    <label>이메일<input name="email" type="email" autoComplete="email" required placeholder="student@example.com" /></label>
    <label>닉네임<input name="nickname" required minLength={2} maxLength={100} placeholder="화면에 표시할 이름" /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="8자 이상" /></label>
    {message && <p role="status">{message}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "가입 중…" : "가입하기"}</button>
  </form>;
}

// 초대 코드 사용에 성공하면 서버 컴포넌트의 계정 상태를 다시 불러온다.
// 기능 `InvitationForm`(): 먼저 `const router = useRouter();`를 실행한다.
export function InvitationForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("서버에 연결할 수 없습니다. 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      const response = await fetch("/api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code") }) });
      const data = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(data.message ?? "초대 코드를 확인하세요.");`를 실행한다. 거짓이면 먼저 `router.refresh();`를 실행한다.
      // 단락 분기 `data.message`: null 또는 undefined인 경우에만 오른쪽 `"초대 코드를 확인하세요."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!response.ok) setError(data.message ?? "초대 코드를 확인하세요.");
      else router.refresh();
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `busy`: 참이면 `"확인 중…"`, 거짓이면 `"학생 인증하기"`를 사용한다.
  return <form className="auth-form" onSubmit={submit}>
    <label>초대 코드<input name="code" required autoComplete="off" placeholder="초대 코드 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "확인 중…" : "학생 인증하기"}</button>
  </form>;
}
