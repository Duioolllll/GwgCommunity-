/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { useEffect, useState } from "react";

type Application = { id: string; recruitmentTitle: string; applicantName: string; answers: { answer?: string }; status: string };
const labels: Record<string, string> = { SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" };
// 기능 `ClubApplications`({ slug }): 먼저 `const [applications, setApplications] = useState<Application[]>([]);`를 실행한다.
export default function ClubApplications({ slug }: { slug: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const url = `/api/clubs/${encodeURIComponent(slug)}/applications`;
  // 기능 `콜백`(): 먼저 `fetch(url).then(async (response) => { const data = await response.json(); if (response.ok) setApplications(data.applications); else setMessage(data.message); }).catch(() => setMessage("신청서를 불러오지 못했습니다."));`를 실행한다.
  // 기능 `콜백`(response): 먼저 `const data = await response.json();`를 실행한다.
  // 조건 `response.ok`: 참이면 먼저 `setApplications(data.applications);`를 실행한다. 거짓이면 먼저 `setMessage(data.message);`를 실행한다.
  // 기능 `콜백`(): `setMessage("신청서를 불러오지 못했습니다.")` 평가 결과를 반환한다.
  useEffect(() => { fetch(url).then(async (response) => { const data = await response.json(); if (response.ok) setApplications(data.applications); else setMessage(data.message); }).catch(() => setMessage("신청서를 불러오지 못했습니다.")); }, [url]);
  // 서버가 상태 변경을 수락한 경우에만 화면의 해당 지원서를 갱신한다.
  // 기능 `update`(applicationId, status): `TryStatement` 구문을 실행한다.
  async function update(applicationId: string, status: string) {
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setMessage("상태를 변경하지 못했습니다.");`를 실행한다.
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, status }) });
      // 조건 `!response.ok`: 참이면 먼저 `const data = await response.json();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (!response.ok) { const data = await response.json(); setMessage(data.message); return; }
      // 기능 `콜백`(current): `current.map((item) => item.id === applicationId ? { ...item, status } : item)` 평가 결과를 반환한다.
      // 기능 `콜백`(item): `item.id === applicationId ? { ...item, status } : item` 평가 결과를 반환한다.
      // 선택 조건 `item.id === applicationId`: 참이면 `{ ...item, status }`, 거짓이면 `item`를 사용한다.
      setApplications((current) => current.map((item) => item.id === applicationId ? { ...item, status } : item)); setMessage("신청 상태를 변경했습니다.");
    } catch { setMessage("상태를 변경하지 못했습니다."); }
  }
  // 단락 분기 `message`: 참인 경우에만 오른쪽 `<p role="status">{message}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `applications.length === 0 && !message`: 참인 경우에만 오른쪽 `<p className="muted-copy">접수된 지원서가 없습니다.</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `applications.length === 0`: 참인 경우에만 오른쪽 `!message`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(item): `<article key={item.id} className="empty-note"><strong>{item.recruitmentTitle} · {item.applicantName}</strong><p>{item.answers?.answer}</p><label>신청 상태 <select value={item.status} disabled={item.status === "CANCELLED"} onChange={(event) => update(item.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value} disabled={value === "SUBMITTED" || value === "CANCELLED"}>{label}</option>)}</select></label></article>` 평가 결과를 반환한다.
  // 기능 `콜백`(event): `update(item.id, event.target.value)` 평가 결과를 반환한다.
  // 기능 `콜백`([value, label]): `<option key={value} value={value} disabled={value === "SUBMITTED" || value === "CANCELLED"}>{label}</option>` 평가 결과를 반환한다.
  // 단락 분기 `value === "SUBMITTED"`: 거짓인 경우에만 오른쪽 `value === "CANCELLED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <section className="services-section"><h2>지원서 관리</h2>{message && <p role="status">{message}</p>}{applications.length === 0 && !message && <p className="muted-copy">접수된 지원서가 없습니다.</p>}{applications.map((item) => <article key={item.id} className="empty-note"><strong>{item.recruitmentTitle} · {item.applicantName}</strong><p>{item.answers?.answer}</p><label>신청 상태 <select value={item.status} disabled={item.status === "CANCELLED"} onChange={(event) => update(item.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value} disabled={value === "SUBMITTED" || value === "CANCELLED"}>{label}</option>)}</select></label></article>)}</section>;
}
