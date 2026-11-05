"use client";
import { useState } from "react";
import Image from "next/image";

type Uploaded = { id: string; url: string; name: string };
export function PostImagesInput({ onChange, onPending }: { onChange: (ids: string[]) => void; onPending: (pending: boolean) => void }) {
  const [images, setImages] = useState<Uploaded[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (images.length >= 4) { setError("이미지는 최대 4장까지 첨부할 수 있습니다."); return; }
    setError(""); setUploading(true); onPending(true);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/media", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "이미지를 업로드하지 못했습니다."); return; }
      const next = [...images, { id: data.asset.id as string, url: `/api/media/${data.asset.id}`, name: file.name }];
      setImages(next); onChange(next.map(image => image.id));
    } catch { setError("이미지를 업로드하지 못했습니다."); } finally { setUploading(false); onPending(false); }
  }
  function remove(id: string) { const next = images.filter(image => image.id !== id); setImages(next); onChange(next.map(image => image.id)); }
  return <div><label>이미지 첨부 (최대 4장, 각 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || images.length >= 4} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file); }} /></label>
    <p>JPEG, PNG, WebP 정지 이미지만 가능합니다. 공개 전 검토됩니다.</p>{error && <p role="alert">{error}</p>}
    {images.map(image => <div key={image.id}><Image unoptimized src={image.url} alt={`${image.name} 미리보기`} width={120} height={120} style={{ objectFit: "contain" }} /><button type="button" disabled={uploading} onClick={() => remove(image.id)}>이미지 제외</button></div>)}
  </div>;
}
