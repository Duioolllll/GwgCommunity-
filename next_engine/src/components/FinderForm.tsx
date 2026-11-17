"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";
import type { FinderInput } from "@/features/finder/posts";

// 분실·습득물 정보를 등록하거나 수정하는 입력 화면을 만든다.
export function FinderForm({ initial }: { initial?: FinderInput & { id: string } }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // 사진 ID는 신규 글에만 전달하므로 수정할 때 기존 첨부는 그대로 둔다.
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 확인할 조건: submitting 있음 또는 true. 해당하면 현재 작업을 그만둔다.
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 아래에 있는 작업을 실행한다.
    try {
      // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 필요한 값을 넣어 만든 글자를 사용하고, 아니면 “/api/finder” 값을 사용한다.
      // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 “수정” 값을 사용하고, 아니면 “등록” 값을 사용한다.
      // 선택 기준: 수정할 기존 글 없음 또는 false. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
      const response = await fetch(initial ? `/api/finder/${initial.id}` : "/api/finder", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(data.message ?? "등록에 실패했습니다.");
      else { router.push(initial ? `/finder/${initial.id}` : "/finder"); router.refresh(); }
    } catch {
      setError("연결에 실패했습니다. 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  }
  // 수정할 기존 글의 분실·습득 종류이 비어 있으면 “분실” 값을 대신 사용한다.
  // 아님(수정할 기존 글)이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 “기존 사진은 유지됩니다. 수정한 글은 다시 검토한 뒤 공개됩니다.” 값을 사용하고, 아니면 “등록한 글은 검토 후 공개되며, 그 전에는 본인에게만 보입니다.” 값을 사용한다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // submitting이 없거나 조건에 맞지 않을 때 업로드 중 표시을 대신 사용한다.
  // 선택 기준: submitting 있음 또는 true. 맞으면 “저장 중...” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
  // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 “수정 완료” 값을 사용하고, 아니면 “분실물 등록하기” 값을 사용한다.
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
