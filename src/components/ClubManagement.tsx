"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Recruitment = { id: string; title: string; description: string; opensAt: Date; closesAt: Date; isOpen: boolean };
type Club = { slug: string; name: string; category: string; introduction: string; isPublic: boolean; recruitments: Recruitment[] };
function localDate(value: Date) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export default function ClubManagement({ club }: { club: Club }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function send(path: string, method: string, data: object) {
    try { const response = await fetch(`/api/clubs/${encodeURIComponent(club.slug)}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); setMessage(response.ok ? "저장했습니다." : result.message); if (response.ok) router.refresh(); } catch { setMessage("저장하지 못했습니다. 다시 시도해주세요."); }
  }
  function fields(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); return new FormData(event.currentTarget); }
  return <section className="services-section"><h2>동아리 운영</h2>{message && <p role="status">{message}</p>}
    <details><summary>동아리 소개 수정</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("", "PATCH", { name: f.get("name"), category: f.get("category"), introduction: f.get("introduction"), isPublic: f.has("isPublic") }); }}>
      <label>이름<input name="name" required maxLength={120} defaultValue={club.name} /></label><label>분류<input name="category" required maxLength={50} defaultValue={club.category} /></label><label>소개<textarea name="introduction" required maxLength={5000} defaultValue={club.introduction} /></label><label><input type="checkbox" name="isPublic" defaultChecked={club.isPublic} /> 공개</label><button className="button button-dark">소개 저장</button></form></details>
    <details><summary>모집 공고 작성</summary><RecruitmentForm onSave={data => send("/recruitments", "POST", data)} /></details>
    {club.recruitments.map(item => <details key={item.id}><summary>모집 공고 수정: {item.title}</summary><RecruitmentForm item={item} onSave={data => send("/recruitments", "PATCH", { ...data, id: item.id })} /></details>)}
    <details><summary>동아리 소식 작성</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("/posts", "POST", { title: f.get("title"), content: f.get("content"), isPublic: f.has("isPublic") }); }}><label>제목<input name="title" required maxLength={120} /></label><label>내용<textarea name="content" required maxLength={5000} /></label><label><input type="checkbox" name="isPublic" /> 공개</label><button className="button button-dark">소식 등록</button></form></details>
  </section>;
}
function RecruitmentForm({ item, onSave }: { item?: Recruitment; onSave: (data: object) => Promise<void> }) {
  const [error, setError] = useState("");
  return <form className="auth-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const opensAt = new Date(String(f.get("opensAt"))); const closesAt = new Date(String(f.get("closesAt"))); if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) { setError("종료 시각은 시작 시각보다 늦어야 합니다."); return; } setError(""); void onSave({ title: f.get("title"), description: f.get("description"), opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(), isOpen: f.has("isOpen") }); }}><label>제목<input name="title" required maxLength={120} defaultValue={item?.title} /></label><label>내용<textarea name="description" required maxLength={5000} defaultValue={item?.description} /></label><label>시작<input type="datetime-local" name="opensAt" required defaultValue={item && localDate(item.opensAt)} /></label><label>종료<input type="datetime-local" name="closesAt" required defaultValue={item && localDate(item.closesAt)} /></label><label><input type="checkbox" name="isOpen" defaultChecked={item?.isOpen} /> 모집 활성화</label>{error && <p role="alert">{error}</p>}<button className="button button-dark">공고 저장</button></form>;
}
