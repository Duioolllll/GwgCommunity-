"use client";

import { useEffect, useState } from "react";

export default function ClubApplicationForm({ slug, recruitmentId, open }: { slug: string; recruitmentId: string; open: boolean }) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/clubs/${encodeURIComponent(slug)}/applications?mine=1`).then(r => r.ok ? r.json() : null).then(data => { const found = data?.applications?.find((item: { recruitmentId: string }) => item.recruitmentId === recruitmentId); if (found) setStatus(found.status); }).catch(() => {}); }, [slug, recruitmentId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(slug)}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recruitmentId, answer }) });
      const data = await response.json();
      setMessage(response.ok ? "지원서가 접수되었습니다." : data.message || "지원서를 접수하지 못했습니다.");
      if (response.ok) { setAnswer(""); setStatus("SUBMITTED"); }
    } catch { setMessage("연결을 확인하고 다시 시도해주세요."); } finally { setPending(false); }
  }
  if (status) return <p role="status">지원 상태: {({ SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as Record<string, string>)[status] ?? status}</p>;
  if (!open) return null;
  return <form className="auth-form" onSubmit={submit}><label>지원 동기와 자기소개<textarea required maxLength={2000} rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><button className="button button-dark" disabled={pending}>{pending ? "접수 중" : "지원하기"}</button>{message && <p role="status">{message}</p>}</form>;
}
