/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";

type Initial = { id: string; title: string; category: string; price: number; description: string };
// 기능 `MarketForm`({ initial }): 먼저 `const router = useRouter();`를 실행한다.
export function MarketForm({ initial }: { initial?: Initial }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // 가격을 숫자로 변환하고 신규 글에만 업로드한 이미지 ID를 포함한다.
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("연결할 수 없습니다. 잠시 후 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      // 선택 조건 `initial`: 참이면 ``/api/market/${initial.id}``, 거짓이면 `"/api/market"`를 사용한다.
      // 선택 조건 `initial`: 참이면 `"PATCH"`, 거짓이면 `"POST"`를 사용한다.
      // 선택 조건 `!initial`: 참이면 `{ imageIds }`, 거짓이면 `{}`를 사용한다.
      const response = await fetch(initial ? `/api/market/${initial.id}` : "/api/market", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), price: Number(form.get("price")), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(data.message ?? "저장에 실패했습니다.");`를 실행한다. 거짓이면 먼저 `router.push(`/market/${data.post.id}`);`를 실행한다.
      // 단락 분기 `data.message`: null 또는 undefined인 경우에만 오른쪽 `"저장에 실패했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!response.ok) setError(data.message ?? "저장에 실패했습니다.");
      else { router.push(`/market/${data.post.id}`); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 단락 분기 `initial?.category`: null 또는 undefined인 경우에만 오른쪽 `"책·교재"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!initial`: 참인 경우에만 오른쪽 `<PostImagesInput onChange={setImageIds} onPending={setUploading} />`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `busy`: 거짓인 경우에만 오른쪽 `uploading`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `busy`: 참이면 `"저장 중…"`, 거짓이면 `initial ? "수정 완료" : "상품 등록하기"`를 사용한다.
  // 선택 조건 `initial`: 참이면 `"수정 완료"`, 거짓이면 `"상품 등록하기"`를 사용한다.
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
