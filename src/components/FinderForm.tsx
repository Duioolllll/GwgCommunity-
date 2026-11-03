"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function FinderForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/finder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? "등록에 실패했습니다.");
    else router.push("/finder");
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>유형<select name="kind" defaultValue="lost"><option value="lost">분실물</option><option value="found">습득물</option></select></label>
    <label>물건 이름<input name="title" required placeholder="예: 검정색 무선 이어폰" /></label>
    <label>분류<input name="category" required placeholder="전자기기, 문구 등" /></label>
    <label>색상<input name="color" required placeholder="검정색" /></label>
    <label>대략적인 장소<input name="generalLocation" required placeholder="본관 2층 부근" /></label>
    <label>날짜<input name="occurredAt" type="date" required /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark" type="submit">분실물 등록하기</button>
  </form>;
}
