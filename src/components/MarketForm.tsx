"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function MarketForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), price: Number(form.get("price")) }) });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? "등록에 실패했습니다.");
    else router.push("/market");
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>제목<input name="title" required placeholder="상품 제목" /></label>
    <label>카테고리<select name="category" defaultValue="책·교재"><option>책·교재</option><option>의류</option><option>전자기기</option><option>나눔</option><option>기타</option></select></label>
    <label>가격<input name="price" type="number" min="0" required placeholder="0" /></label>
    <label>설명<textarea name="description" required placeholder="상품 상태와 거래 안내" rows={5} /></label>
    {error && <p className="form-error">{error}</p>}
    <button className="button button-dark" type="submit">상품 등록하기</button>
  </form>;
}
