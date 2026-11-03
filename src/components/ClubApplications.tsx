"use client";

import { useEffect, useState } from "react";

type Application = { id: string; recruitmentTitle: string; applicantName: string; answers: { answer?: string }; status: string };
const labels: Record<string, string> = { SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" };
export default function ClubApplications({ slug }: { slug: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const url = `/api/clubs/${encodeURIComponent(slug)}/applications`;
  useEffect(() => { fetch(url).then(async (response) => { const data = await response.json(); if (response.ok) setApplications(data.applications); else setMessage(data.message); }).catch(() => setMessage("신청서를 불러오지 못했습니다.")); }, [url]);
  async function update(applicationId: string, status: string) {
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId, status }) });
      if (!response.ok) { const data = await response.json(); setMessage(data.message); return; }
      setApplications((current) => current.map((item) => item.id === applicationId ? { ...item, status } : item)); setMessage("신청 상태를 변경했습니다.");
    } catch { setMessage("상태를 변경하지 못했습니다."); }
  }
  return <section className="services-section"><h2>지원서 관리</h2>{message && <p role="status">{message}</p>}{applications.length === 0 && !message && <p className="muted-copy">접수된 지원서가 없습니다.</p>}{applications.map((item) => <article key={item.id} className="empty-note"><strong>{item.recruitmentTitle} · {item.applicantName}</strong><p>{item.answers?.answer}</p><label>신청 상태 <select value={item.status} disabled={item.status === "CANCELLED"} onChange={(event) => update(item.id, event.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value} disabled={value === "SUBMITTED" || value === "CANCELLED"}>{label}</option>)}</select></label></article>)}</section>;
}
