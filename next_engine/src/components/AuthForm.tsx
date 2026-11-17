"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

// 이메일과 비밀번호를 입력해 로그인하는 화면을 만든다.
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError("로그인할 수 없습니다. 이메일과 비밀번호 또는 이메일 확인 여부를 확인하세요.");
      else { router.push("/me"); router.refresh(); }
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 처리 중 표시 있음 또는 true. 맞으면 “로그인 중…” 값을 사용하고, 아니면 “로그인” 값을 사용한다.
  return <form className="auth-form" onSubmit={submit}>
    <label>이메일<input name="email" type="email" autoComplete="email" required placeholder="student@example.com" /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" required placeholder="비밀번호 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "로그인 중…" : "로그인"}</button>
  </form>;
}

// 가입 요청은 확인 메일을 안내하며 학생 인증은 로그인 후 별도로 진행한다.
// 새 계정을 만드는 가입 화면을 만든다.
export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      const response = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("nickname"), email: form.get("email"), password: form.get("password"), callbackURL: "/auth/login" }) });
      // 선택 기준: 서버 응답의 성공 여부 있음 또는 true. 맞으면 “확인 메일을 보냈습니다. 메일의 링크로 이메일을 확인하고 로그인해 주세요.” 값을 사용하고, 아니면 “가입을 완료할 수 없습니다. 입력 내용을 확인하고 다시 시도하세요.” 값을 사용한다.
      setMessage(response.ok ? "확인 메일을 보냈습니다. 메일의 링크로 이메일을 확인하고 로그인해 주세요." : "가입을 완료할 수 없습니다. 입력 내용을 확인하고 다시 시도하세요.");
    } catch { setMessage("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 안내 문장이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 처리 중 표시 있음 또는 true. 맞으면 “가입 중…” 값을 사용하고, 아니면 “가입하기” 값을 사용한다.
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
// 초대 코드를 입력해 학생 인증을 받는 화면을 만든다.
export function InvitationForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      const response = await fetch("/api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code") }) });
      const data = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(data.message ?? "초대 코드를 확인하세요.");
      else router.refresh();
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 처리 중 표시 있음 또는 true. 맞으면 “확인 중…” 값을 사용하고, 아니면 “학생 인증하기” 값을 사용한다.
  return <form className="auth-form" onSubmit={submit}>
    <label>초대 코드<input name="code" required autoComplete="off" placeholder="초대 코드 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "확인 중…" : "학생 인증하기"}</button>
  </form>;
}
