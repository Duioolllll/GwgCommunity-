"use client";

import { useEffect, useState } from "react";

// 동아리 모집에 지원하는 입력 화면을 만든다.
export default function ClubApplicationForm({ slug, recruitmentId, open }: { slug: string; recruitmentId: string; open: boolean }) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // 현재 모집에 이미 제출한 지원서가 있으면 입력 폼 대신 상태를 표시한다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 선택 기준: r의 성공 여부 있음 또는 true. 맞으면 서버와 주고받는 자료를 사용하고, 아니면 값 없음을 사용한다.
  // 확인할 조건: 찾은 자료 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
  useEffect(() => { fetch(`/api/clubs/${encodeURIComponent(slug)}/applications?mine=1`).then(r => r.ok ? r.json() : null).then(data => { const found = data?.applications?.find((item: { recruitmentId: string }) => item.recruitmentId === recruitmentId); if (found) setStatus(found.status); }).catch(() => {}); }, [slug, recruitmentId]);
  // 입력한 내용을 검사한 뒤 등록 또는 수정 요청을 서버에 보낸다.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(slug)}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recruitmentId, answer }) });
      const data = await response.json();
      setMessage(response.ok ? "지원서가 접수되었습니다." : data.message || "지원서를 접수하지 못했습니다.");
      // 확인할 조건: 서버 응답의 성공 여부 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
      if (response.ok) { setAnswer(""); setStatus("SUBMITTED"); }
    } catch { setMessage("연결을 확인하고 다시 시도해주세요."); } finally { setPending(false); }
  }
  // 확인할 조건: 상태 있음 또는 true. 해당하면 해당 화면을 돌려준다.
  // 필요한 항목을 묶은 자료에서 상태에 해당하는 값이 비어 있으면 상태을 대신 사용한다.
  if (status) return <p role="status">지원 상태: {({ SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as Record<string, string>)[status] ?? status}</p>;
  // 확인할 조건: open 없음 또는 false. 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!open) return null;
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  // 선택 기준: 검토 대기 상태 있음 또는 true. 맞으면 “접수 중” 값을 사용하고, 아니면 “지원하기” 값을 사용한다.
  // 안내 문장이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  return <form className="auth-form" onSubmit={submit}><label>지원 동기와 자기소개<textarea required maxLength={2000} rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><button className="button button-dark" disabled={pending}>{pending ? "접수 중" : "지원하기"}</button>{message && <p role="status">{message}</p>}</form>;
}
