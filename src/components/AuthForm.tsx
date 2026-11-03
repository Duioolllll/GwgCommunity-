"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? "로그인에 실패했습니다.");
    else router.push("/me");
    setBusy(false);
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>이메일<input name="email" type="email" required placeholder="student@example.com" /></label>
    <label>비밀번호<input name="password" type="password" required placeholder="비밀번호 입력" /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "로그인 중…" : "로그인"}</button>
  </form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? "가입에 실패했습니다.");
    else router.push("/me");
    setBusy(false);
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>초대 코드<input name="code" required placeholder="초대 코드 입력" /></label>
    <label>이메일<input name="email" type="email" required placeholder="확인된 이메일" /></label>
    <label>닉네임<input name="nickname" required minLength={2} placeholder="화면에 표시할 이름" /></label>
    <label>비밀번호<input name="password" type="password" required minLength={8} placeholder="8자 이상" /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark" disabled={busy} type="submit">{busy ? "가입 중…" : "학생 가입하기"}</button>
  </form>;
}
