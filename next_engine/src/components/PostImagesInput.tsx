"use client";
import { useState } from "react";
import Image from "next/image";

type Uploaded = { id: string; url: string; name: string };
// 이미지를 업로드하고 첨부할 사진을 고르는 입력 화면을 만든다.
export function PostImagesInput({ onChange, onPending }: { onChange: (ids: string[]) => void; onPending: (pending: boolean) => void }) {
  const [images, setImages] = useState<Uploaded[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  // 업로드 중에는 부모 폼에 대기 상태를 알리고 성공한 자산 ID만 전달한다.
  // 선택한 이미지를 서버에 올리고 성공한 이미지 번호를 첨부 목록에 넣는다.
  async function upload(file: File | undefined) {
    // 확인할 조건: 선택한 파일 없음 또는 false. 해당하면 현재 작업을 그만둔다.
    if (!file) return;
    // 확인할 조건: 이미지 목록의 개수 또는 길이 ≥ 4. 해당하면 실패한 이유를 화면에 표시한다.
    if (images.length >= 4) { setError("이미지는 최대 4장까지 첨부할 수 있습니다."); return; }
    setError(""); setUploading(true); onPending(true);
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 아래에 있는 작업을 실행한다.
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/media", { method: "POST", body });
      const data = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) { setError(data.message ?? "이미지를 업로드하지 못했습니다."); return; }
      const next = [...images, { id: data.asset.id as string, url: `/api/media/${data.asset.id}`, name: file.name }];
      setImages(next); onChange(next.map(image => image.id));
    } catch { setError("이미지를 업로드하지 못했습니다."); } finally { setUploading(false); onPending(false); }
  }
  // 제외는 폼의 첨부 목록에서만 제거하며 저장 객체 삭제 요청은 보내지 않는다.
  // 선택한 이미지를 이 글의 첨부 목록에서 뺀다.
  // 이 조건에 맞는 항목만 목록에 남긴다.
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  function remove(id: string) { const next = images.filter(image => image.id !== id); setImages(next); onChange(next.map(image => image.id)); }
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  return <div><label>이미지 첨부 (최대 4장, 각 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || images.length >= 4} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file); }} /></label>
    <p>JPEG, PNG, WebP 정지 이미지만 가능합니다. 공개 전 검토됩니다.</p>{error && <p role="alert">{error}</p>}
    {images.map(image => <div key={image.id}><Image unoptimized src={image.url} alt={`${image.name} 미리보기`} width={120} height={120} style={{ objectFit: "contain" }} /><button type="button" disabled={uploading} onClick={() => remove(image.id)}>이미지 제외</button></div>)}
  </div>;
}
