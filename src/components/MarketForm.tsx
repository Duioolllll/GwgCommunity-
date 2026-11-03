"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";

type Initial = { id: string; title: string; category: string; price: number; description: string };
export function MarketForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(initial ? `/api/market/${initial.id}` : "/api/market", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), price: Number(form.get("price")), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      if (!response.ok) setError(data.message ?? "저장에 실패했습니다.");
      else { router.push(`/market/${data.post.id}`); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>제목<input name="title" required maxLength={120} defaultValue={initial?.title} placeholder="상품 제목" /></label>
    <label>카테고리<select name="category" defaultValue={initial?.category ?? "책·교재"}><option>책·교재</option><option>의류</option><option>전자기기</option><option>나눔</option><option>기타</option></select></label>
    <label>가격<input name="price" type="number" min="0" max="100000000" step="1" required defaultValue={initial?.price} placeholder="0" /></label>
    <label>설명<textarea name="description" required maxLength={5000} defaultValue={initial?.description} placeholder="상품 상태를 적어주세요. 연락처와 정확한 만남 장소는 적지 마세요." rows={5} /></label>
    {!initial && <PostImagesInput onChange={setImageIds} onPending={setUploading} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" type="submit" disabled={busy || uploading}>{busy ? "저장 중…" : initial ? "수정 완료" : "상품 등록하기"}</button>
  </form>;
}
