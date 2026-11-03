"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      if (!response.ok) setError("로그인할 수 없습니다. 이메일과 비밀번호 또는 이메일 확인 여부를 확인하세요.");
      else { router.push("/me"); router.refresh(); }
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>이메일<input name="email" type="email" autoComplete="email" required placeholder="student@example.com" /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="current-password" required placeholder="비밀번호 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "로그인 중…" : "로그인"}</button>
  </form>;
}

export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("nickname"), email: form.get("email"), password: form.get("password"), callbackURL: "/auth/login" }) });
      setMessage(response.ok ? "확인 메일을 보냈습니다. 메일의 링크로 이메일을 확인하고 로그인해 주세요." : "가입을 완료할 수 없습니다. 입력 내용을 확인하고 다시 시도하세요.");
    } catch { setMessage("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <p>이메일 확인과 로그인 후 초대 코드를 입력합니다.</p>
    <label>이메일<input name="email" type="email" autoComplete="email" required placeholder="student@example.com" /></label>
    <label>닉네임<input name="nickname" required minLength={2} maxLength={100} placeholder="화면에 표시할 이름" /></label>
    <label>비밀번호<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} placeholder="8자 이상" /></label>
    {message && <p role="status">{message}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "가입 중…" : "가입하기"}</button>
  </form>;
}

export function InvitationForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/invitations/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: form.get("code") }) });
      const data = await response.json();
      if (!response.ok) setError(data.message ?? "초대 코드를 확인하세요.");
      else router.refresh();
    } catch { setError("서버에 연결할 수 없습니다. 다시 시도하세요."); } finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>초대 코드<input name="code" required autoComplete="off" placeholder="초대 코드 입력" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "확인 중…" : "학생 인증하기"}</button>
  </form>;
}
