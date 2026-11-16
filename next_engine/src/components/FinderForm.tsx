/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PostImagesInput } from "./PostImagesInput";
import type { FinderInput } from "@/features/finder/posts";

// 기능 `FinderForm`({ initial }): 먼저 `const router = useRouter();`를 실행한다.
export function FinderForm({ initial }: { initial?: FinderInput & { id: string } }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // 사진 ID는 신규 글에만 전달하므로 수정할 때 기존 첨부는 그대로 둔다.
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 조건 `submitting`: 참이면 값 없이 현재 함수를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("연결에 실패했습니다. 다시 시도해 주세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setSubmitting(false);`를 실행한다.
    try {
      // 선택 조건 `initial`: 참이면 ``/api/finder/${initial.id}``, 거짓이면 `"/api/finder"`를 사용한다.
      // 선택 조건 `initial`: 참이면 `"PATCH"`, 거짓이면 `"POST"`를 사용한다.
      // 선택 조건 `!initial`: 참이면 `{ imageIds }`, 거짓이면 `{}`를 사용한다.
      const response = await fetch(initial ? `/api/finder/${initial.id}` : "/api/finder", { method: initial ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), ...(!initial ? { imageIds } : {}) }) });
      const data = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(data.message ?? "등록에 실패했습니다.");`를 실행한다. 거짓이면 먼저 `router.push(initial ? `/finder/${initial.id}` : "/finder");`를 실행한다.
      // 단락 분기 `data.message`: null 또는 undefined인 경우에만 오른쪽 `"등록에 실패했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      // 선택 조건 `initial`: 참이면 ``/finder/${initial.id}``, 거짓이면 `"/finder"`를 사용한다.
      if (!response.ok) setError(data.message ?? "등록에 실패했습니다.");
      else { router.push(initial ? `/finder/${initial.id}` : "/finder"); router.refresh(); }
    } catch {
      setError("연결에 실패했습니다. 다시 시도해 주세요.");
    } finally { setSubmitting(false); }
  }
  // 단락 분기 `initial?.kind`: null 또는 undefined인 경우에만 오른쪽 `"lost"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!initial`: 참인 경우에만 오른쪽 `<PostImagesInput onChange={setImageIds} onPending={setUploading} />`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `initial`: 참이면 `"기존 사진은 유지됩니다. 수정한 글은 다시 검토한 뒤 공개됩니다."`, 거짓이면 `"등록한 글은 검토 후 공개되며, 그 전에는 본인에게만 보입니다."`를 사용한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `submitting`: 거짓인 경우에만 오른쪽 `uploading`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `submitting`: 참이면 `"저장 중..."`, 거짓이면 `initial ? "수정 완료" : "분실물 등록하기"`를 사용한다.
  // 선택 조건 `initial`: 참이면 `"수정 완료"`, 거짓이면 `"분실물 등록하기"`를 사용한다.
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
