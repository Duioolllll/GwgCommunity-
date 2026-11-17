"use client";

import { useEffect, useState } from "react";

type Application = { id: string; recruitmentTitle: string; applicantName: string; answers: { answer?: string }; status: string };
const labels: Record<string, string> = { SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" };
// 동아리 지원서 목록과 합격·거절 처리 화면을 만든다.
export default function ClubApplications({ slug }: { slug: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const url = `/api/clubs/${encodeURIComponent(slug)}/applications`;
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 확인할 조건: 서버 응답의 성공 여부 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 아래에 있는 작업을 실행한다.
  useEffect(() => { fetch(url).then(async (response) => { const data = await response.json(); if (response.ok) setApplications(data.applications); else setMessage(data.message); }).catch(() => setMessage("신청서를 불러오지 못했습니다.")); }, [url]);
  // 서버가 상태 변경을 수락한 경우에만 화면의 해당 지원서를 갱신한다.
  // update 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  async function update(applicationId: string, status: string) {
    // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다.
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, status }) });
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) { const data = await response.json(); setMessage(data.message); return; }
      // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
      // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
      // 선택 기준: 현재 항목의 고유 번호 = applicationId. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 현재 항목을 사용한다.
      setApplications((current) => current.map((item) => item.id === applicationId ? { ...item, status } : item)); setMessage("신청 상태를 변경했습니다.");
    } catch { setMessage("상태를 변경하지 못했습니다."); }
  }
  // 안내 문장이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  return <section className="services-section"><h2>지원서 관리</h2>{message && <p role="status">{message}</p>}{applications.length === 0 && !message && <p className="muted-copy">접수된 지원서가 없습니다.</p>}{applications.map((item) => <article key={item.id} className="empty-note"><strong>{item.recruitmentTitle} · {item.applicantName}</strong><p>{item.answers?.answer}</p><label>신청 상태 <select value={item.status} disabled={item.status === "CANCELLED"} onChange={(event) => update(item.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value} disabled={value === "SUBMITTED" || value === "CANCELLED"}>{label}</option>)}</select></label></article>)}</section>;
}
