"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Recruitment = { id: string; title: string; description: string; opensAt: Date; closesAt: Date; isOpen: boolean };
type Club = { slug: string; name: string; category: string; introduction: string; isPublic: boolean; recruitments: Recruitment[] };
// datetime-local 입력에는 브라우저 현지 시각을 쓰고 저장 시 ISO 시각으로 변환한다.
// 모집 날짜를 사용자의 지역 시간에 맞춰 입력창에 보여줄 글자로 바꾼다.
function localDate(value: Date) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
// 동아리 소개·활동·모집을 관리하는 화면을 만든다.
export default function ClubManagement({ club }: { club: Club }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  // send 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  async function send(path: string, method: string, data: object) {
    // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다.
    // 선택 기준: 서버 응답의 성공 여부 있음 또는 true. 맞으면 “저장했습니다.” 값을 사용하고, 아니면 처리 결과의 안내 문장을 사용한다.
    // 확인할 조건: 서버 응답의 성공 여부 있음 또는 true. 해당하면 화면의 자료를 다시 불러온다.
    try { const response = await fetch(`/api/clubs/${encodeURIComponent(club.slug)}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); setMessage(response.ok ? "저장했습니다." : result.message); if (response.ok) router.refresh(); } catch { setMessage("저장하지 못했습니다. 다시 시도해주세요."); }
  }
  // fields 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  function fields(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); return new FormData(event.currentTarget); }
  // 안내 문장이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  return <section className="services-section"><h2>동아리 운영</h2>{message && <p role="status">{message}</p>}
    <details><summary>동아리 소개 수정</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("", "PATCH", { name: f.get("name"), category: f.get("category"), introduction: f.get("introduction"), isPublic: f.has("isPublic") }); }}>
      <label>이름<input name="name" required maxLength={120} defaultValue={club.name} /></label><label>분류<input name="category" required maxLength={50} defaultValue={club.category} /></label><label>소개<textarea name="introduction" required maxLength={5000} defaultValue={club.introduction} /></label><label className="club-checkbox"><input type="checkbox" name="isPublic" defaultChecked={club.isPublic} /><span>공개</span></label><button className="button button-dark">소개 저장</button></form></details>
    <details><summary>모집 공고 작성</summary><RecruitmentForm onSave={data => send("/recruitments", "POST", data)} /></details>
    {club.recruitments.map(item => <details key={item.id}><summary>모집 공고 수정: {item.title}</summary><RecruitmentForm item={item} onSave={data => send("/recruitments", "PATCH", { ...data, id: item.id })} /></details>)}
    <details><summary>동아리 소식 작성</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("/posts", "POST", { title: f.get("title"), content: f.get("content"), isPublic: f.has("isPublic") }); }}><label>제목<input name="title" required maxLength={120} /></label><label>내용<textarea name="content" required maxLength={5000} /></label><label className="club-checkbox"><input type="checkbox" name="isPublic" /><span>공개</span></label><button className="button button-dark">소식 등록</button></form></details>
  </section>;
}
// 시작·종료의 유효성과 순서를 확인한 뒤 공고를 저장한다.
// 모집 제목과 기간을 등록하거나 수정하는 입력 화면을 만든다.
function RecruitmentForm({ item, onSave }: { item?: Recruitment; onSave: (data: object) => Promise<void> }) {
  const [error, setError] = useState("");
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 확인할 조건: ((모집 시작 시각를 숫자로 바꾼 값이 정상적인 숫자임 조건을 만족하지 않음) 또는 (모집 마감 시각를 숫자로 바꾼 값이 정상적인 숫자임 조건을 만족하지 않음)) 또는 (모집 마감 시각 ≤ 모집 시작 시각). 해당하면 실패한 이유를 화면에 표시한다.
  // 현재 항목이 있거나 조건에 맞을 때만 localDate 처리 결과를 처리한다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  return <form className="auth-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const opensAt = new Date(String(f.get("opensAt"))); const closesAt = new Date(String(f.get("closesAt"))); if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) { setError("종료 시각은 시작 시각보다 늦어야 합니다."); return; } setError(""); void onSave({ title: f.get("title"), description: f.get("description"), opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(), isOpen: f.has("isOpen") }); }}><label>제목<input name="title" required maxLength={120} defaultValue={item?.title} /></label><label>내용<textarea name="description" required maxLength={5000} defaultValue={item?.description} /></label><label>시작<input type="datetime-local" name="opensAt" required defaultValue={item && localDate(item.opensAt)} /></label><label>종료<input type="datetime-local" name="closesAt" required defaultValue={item && localDate(item.closesAt)} /></label><label className="club-checkbox"><input type="checkbox" name="isOpen" defaultChecked={item?.isOpen} /><span>모집 활성화</span></label>{error && <p role="alert">{error}</p>}<button className="button button-dark">공고 저장</button></form>;
}
