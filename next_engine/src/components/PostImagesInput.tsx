/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";
import { useState } from "react";
import Image from "next/image";

type Uploaded = { id: string; url: string; name: string };
// 기능 `PostImagesInput`({ onChange, onPending }): 먼저 `const [images, setImages] = useState<Uploaded[]>([]);`를 실행한다.
export function PostImagesInput({ onChange, onPending }: { onChange: (ids: string[]) => void; onPending: (pending: boolean) => void }) {
  const [images, setImages] = useState<Uploaded[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  // 업로드 중에는 부모 폼에 대기 상태를 알리고 성공한 자산 ID만 전달한다.
  // 기능 `upload`(file): `!file` 조건을 추가로 검사한다.
  async function upload(file: File | undefined) {
    // 조건 `!file`: 참이면 값 없이 현재 함수를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!file) return;
    // 조건 `images.length >= 4`: 참이면 먼저 `setError("이미지는 최대 4장까지 첨부할 수 있습니다.");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (images.length >= 4) { setError("이미지는 최대 4장까지 첨부할 수 있습니다."); return; }
    setError(""); setUploading(true); onPending(true);
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("이미지를 업로드하지 못했습니다.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setUploading(false);`를 실행한다.
    // 기능 `콜백`(image): `image.id` 평가 결과를 반환한다.
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/media", { method: "POST", body });
      const data = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(data.message ?? "이미지를 업로드하지 못했습니다.");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      // 단락 분기 `data.message`: null 또는 undefined인 경우에만 오른쪽 `"이미지를 업로드하지 못했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!response.ok) { setError(data.message ?? "이미지를 업로드하지 못했습니다."); return; }
      const next = [...images, { id: data.asset.id as string, url: `/api/media/${data.asset.id}`, name: file.name }];
      setImages(next); onChange(next.map(image => image.id));
    } catch { setError("이미지를 업로드하지 못했습니다."); } finally { setUploading(false); onPending(false); }
  }
  // 제외는 폼의 첨부 목록에서만 제거하며 저장 객체 삭제 요청은 보내지 않는다.
  // 기능 `remove`(id): 먼저 `const next = images.filter(image => image.id !== id);`를 실행한다.
  // 기능 `콜백`(image): `image.id !== id` 평가 결과를 반환한다.
  // 기능 `콜백`(image): `image.id` 평가 결과를 반환한다.
  function remove(id: string) { const next = images.filter(image => image.id !== id); setImages(next); onChange(next.map(image => image.id)); }
  // 단락 분기 `uploading`: 거짓인 경우에만 오른쪽 `images.length >= 4`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(e): 먼저 `const file = e.currentTarget.files?.[0];`를 실행한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(image): `<div key={image.id}><Image unoptimized src={image.url} alt={`${image.name} 미리보기`} width={120} height={120} style={{ objectFit: "contain" }} /><button type="button" disabled={uploading} onClick={() => remove(image.id)}>이미지 제외</button></div>` 평가 결과를 반환한다.
  // 기능 `콜백`(): `remove(image.id)` 평가 결과를 반환한다.
  return <div><label>이미지 첨부 (최대 4장, 각 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || images.length >= 4} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file); }} /></label>
    <p>JPEG, PNG, WebP 정지 이미지만 가능합니다. 공개 전 검토됩니다.</p>{error && <p role="alert">{error}</p>}
    {images.map(image => <div key={image.id}><Image unoptimized src={image.url} alt={`${image.name} 미리보기`} width={120} height={120} style={{ objectFit: "contain" }} /><button type="button" disabled={uploading} onClick={() => remove(image.id)}>이미지 제외</button></div>)}
  </div>;
}
