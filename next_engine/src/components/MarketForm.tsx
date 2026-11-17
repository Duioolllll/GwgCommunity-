"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";

type Initial = { id: string; title: string; category: string; price: number; description: string };
// 중고거래 글을 등록하거나 수정하는 입력 화면을 만든다.
export function MarketForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // 가격을 숫자로 변환하고 신규 글에만 업로드한 이미지 ID를 포함한다.
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 거래 글 요청 주소를 사용하고, 아니면 “/api/market” 값을 사용한다.
      // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 “수정” 값을 사용하고, 아니면 “등록” 값을 사용한다.
      // 선택 기준: 수정할 기존 글 없음 또는 false. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
      const response = await fetch(initial ? `/api/market/${initial.id}` : "/api/market", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), price: Number(form.get("price")), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(data.message ?? "저장에 실패했습니다.");
      else { router.push(`/market/${data.post.id}`); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 수정할 기존 글의 분류이 비어 있으면 “책·교재” 값을 대신 사용한다.
  // 아님(수정할 기존 글)이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 처리 중 표시이 없거나 조건에 맞지 않을 때 업로드 중 표시을 대신 사용한다.
  // 선택 기준: 처리 중 표시 있음 또는 true. 맞으면 “저장 중…” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
  // 선택 기준: 수정할 기존 글 있음 또는 true. 맞으면 “수정 완료” 값을 사용하고, 아니면 “상품 등록하기” 값을 사용한다.
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
