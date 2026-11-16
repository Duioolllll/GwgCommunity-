/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Recruitment = { id: string; title: string; description: string; opensAt: Date; closesAt: Date; isOpen: boolean };
type Club = { slug: string; name: string; category: string; introduction: string; isPublic: boolean; recruitments: Recruitment[] };
// datetime-local 입력에는 브라우저 현지 시각을 쓰고 저장 시 ISO 시각으로 변환한다.
// 기능 `localDate`(value): 먼저 `const d = new Date(value);`를 실행한다.
function localDate(value: Date) { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
// 기능 `ClubManagement`({ club }): 먼저 `const router = useRouter();`를 실행한다.
export default function ClubManagement({ club }: { club: Club }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  // 기능 `send`(path, method, data): `TryStatement` 구문을 실행한다.
  async function send(path: string, method: string, data: object) {
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setMessage("저장하지 못했습니다. 다시 시도해주세요.");`를 실행한다.
    // 선택 조건 `response.ok`: 참이면 `"저장했습니다."`, 거짓이면 `result.message`를 사용한다.
    // 조건 `response.ok`: 참이면 먼저 `router.refresh();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    try { const response = await fetch(`/api/clubs/${encodeURIComponent(club.slug)}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json(); setMessage(response.ok ? "저장했습니다." : result.message); if (response.ok) router.refresh(); } catch { setMessage("저장하지 못했습니다. 다시 시도해주세요."); }
  }
  // 기능 `fields`(event): 먼저 `event.preventDefault();`를 실행한다.
  function fields(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); return new FormData(event.currentTarget); }
  // 단락 분기 `message`: 참인 경우에만 오른쪽 `<p role="status">{message}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(e): 먼저 `const f = fields(e);`를 실행한다.
  // 기능 `콜백`(data): `send("/recruitments", "POST", data)` 평가 결과를 반환한다.
  // 기능 `콜백`(item): `<details key={item.id}><summary>모집 공고 수정: {item.title}</summary><RecruitmentForm item={item} onSave={data => send("/recruitments", "PATCH", { ...data, id: item.id })} /></details>` 평가 결과를 반환한다.
  // 기능 `콜백`(data): `send("/recruitments", "PATCH", { ...data, id: item.id })` 평가 결과를 반환한다.
  // 기능 `콜백`(e): 먼저 `const f = fields(e);`를 실행한다.
  return <section className="services-section"><h2>동아리 운영</h2>{message && <p role="status">{message}</p>}
    <details><summary>동아리 소개 수정</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("", "PATCH", { name: f.get("name"), category: f.get("category"), introduction: f.get("introduction"), isPublic: f.has("isPublic") }); }}>
      <label>이름<input name="name" required maxLength={120} defaultValue={club.name} /></label><label>분류<input name="category" required maxLength={50} defaultValue={club.category} /></label><label>소개<textarea name="introduction" required maxLength={5000} defaultValue={club.introduction} /></label><label className="club-checkbox"><input type="checkbox" name="isPublic" defaultChecked={club.isPublic} /><span>공개</span></label><button className="button button-dark">소개 저장</button></form></details>
    <details><summary>모집 공고 작성</summary><RecruitmentForm onSave={data => send("/recruitments", "POST", data)} /></details>
    {club.recruitments.map(item => <details key={item.id}><summary>모집 공고 수정: {item.title}</summary><RecruitmentForm item={item} onSave={data => send("/recruitments", "PATCH", { ...data, id: item.id })} /></details>)}
    <details><summary>동아리 소식 작성</summary><form className="auth-form" onSubmit={e => { const f = fields(e); void send("/posts", "POST", { title: f.get("title"), content: f.get("content"), isPublic: f.has("isPublic") }); }}><label>제목<input name="title" required maxLength={120} /></label><label>내용<textarea name="content" required maxLength={5000} /></label><label className="club-checkbox"><input type="checkbox" name="isPublic" /><span>공개</span></label><button className="button button-dark">소식 등록</button></form></details>
  </section>;
}
// 시작·종료의 유효성과 순서를 확인한 뒤 공고를 저장한다.
// 기능 `RecruitmentForm`({ item, onSave }): 먼저 `const [error, setError] = useState("");`를 실행한다.
function RecruitmentForm({ item, onSave }: { item?: Recruitment; onSave: (data: object) => Promise<void> }) {
  const [error, setError] = useState("");
  // 기능 `콜백`(e): 먼저 `e.preventDefault();`를 실행한다.
  // 조건 `!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt`: 참이면 먼저 `setError("종료 시각은 시작 시각보다 늦어야 합니다.");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime())`: 거짓인 경우에만 오른쪽 `closesAt <= opensAt`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!Number.isFinite(opensAt.getTime())`: 거짓인 경우에만 오른쪽 `!Number.isFinite(closesAt.getTime())`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `item`: 참인 경우에만 오른쪽 `localDate(item.opensAt)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `item`: 참인 경우에만 오른쪽 `localDate(item.closesAt)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <form className="auth-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const opensAt = new Date(String(f.get("opensAt"))); const closesAt = new Date(String(f.get("closesAt"))); if (!Number.isFinite(opensAt.getTime()) || !Number.isFinite(closesAt.getTime()) || closesAt <= opensAt) { setError("종료 시각은 시작 시각보다 늦어야 합니다."); return; } setError(""); void onSave({ title: f.get("title"), description: f.get("description"), opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString(), isOpen: f.has("isOpen") }); }}><label>제목<input name="title" required maxLength={120} defaultValue={item?.title} /></label><label>내용<textarea name="description" required maxLength={5000} defaultValue={item?.description} /></label><label>시작<input type="datetime-local" name="opensAt" required defaultValue={item && localDate(item.opensAt)} /></label><label>종료<input type="datetime-local" name="closesAt" required defaultValue={item && localDate(item.closesAt)} /></label><label className="club-checkbox"><input type="checkbox" name="isOpen" defaultChecked={item?.isOpen} /><span>모집 활성화</span></label>{error && <p role="alert">{error}</p>}<button className="button button-dark">공고 저장</button></form>;
}
