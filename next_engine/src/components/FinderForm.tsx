"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";
import type { FinderInput } from "@/features/finder/posts";

export function FinderForm({ initial }: { initial?: FinderInput & { id: string } }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(initial ? `/api/finder/${initial.id}` : "/api/finder", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      if (!response.ok) setError(data.message ?? "등록에 실패했습니다.");
      else { router.push(initial ? `/finder/${initial.id}` : "/finder"); router.refresh(); }
    } catch {
      setError("연결에 실패했습니다. 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>유형<select name="kind" defaultValue={initial?.kind ?? "lost"}><option value="lost">분실물</option><option value="found">습득물</option></select></label>
    <label>물건 이름<input name="title" required maxLength={120} defaultValue={initial?.title} placeholder="예: 검정색 무선 이어폰" /></label>
    <label>분류<input name="category" required maxLength={50} defaultValue={initial?.category} placeholder="전자기기, 문구 등" /></label>
    <label>색상<input name="color" required maxLength={50} defaultValue={initial?.color} placeholder="검정색" /></label>
    <label>대략적인 장소<input name="generalLocation" required maxLength={120} defaultValue={initial?.generalLocation} placeholder="본관 2층 부근" /></label>
    <label>날짜<input name="occurredAt" type="date" required defaultValue={initial?.occurredAt} /></label>
    {!initial && <PostImagesInput onChange={setImageIds} onPending={setUploading} />}
    <p>{initial ? "기존 사진은 유지됩니다. 수정한 글은 다시 검토한 뒤 공개됩니다." : "등록한 글은 검토 후 공개되며, 그 전에는 본인에게만 보입니다."}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" type="submit" disabled={submitting || uploading}>{submitting ? "저장 중..." : initial ? "수정 완료" : "분실물 등록하기"}</button>
  </form>;
}
