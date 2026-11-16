/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { useEffect, useState } from "react";

// 기능 `ClubApplicationForm`({ slug, recruitmentId, open }): 먼저 `const [answer, setAnswer] = useState("");`를 실행한다.
export default function ClubApplicationForm({ slug, recruitmentId, open }: { slug: string; recruitmentId: string; open: boolean }) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // 현재 모집에 이미 제출한 지원서가 있으면 입력 폼 대신 상태를 표시한다.
  // 기능 `콜백`(): 먼저 `fetch(`/api/clubs/${encodeURIComponent(slug)}/applications?mine=1`).then(r => r.ok ? r.json() : null).then(data => { const found = data?.applications?.find((item: { recruitmentId: string }) => item.recruitmentId === recruitmentId); if (found) setStatus(found.status); }).catch(() => {});`를 실행한다.
  // 기능 `콜백`(r): `r.ok ? r.json() : null` 평가 결과를 반환한다.
  // 선택 조건 `r.ok`: 참이면 `r.json()`, 거짓이면 `null`를 사용한다.
  // 기능 `콜백`(data): 먼저 `const found = data?.applications?.find((item: { recruitmentId: string }) => item.recruitmentId === recruitmentId);`를 실행한다.
  // 기능 `콜백`(item): `item.recruitmentId === recruitmentId` 평가 결과를 반환한다.
  // 조건 `found`: 참이면 먼저 `setStatus(found.status);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 기능 `콜백`(): 별도 처리 없이 다음 구문으로 진행한다.
  useEffect(() => { fetch(`/api/clubs/${encodeURIComponent(slug)}/applications?mine=1`).then(r => r.ok ? r.json() : null).then(data => { const found = data?.applications?.find((item: { recruitmentId: string }) => item.recruitmentId === recruitmentId); if (found) setStatus(found.status); }).catch(() => {}); }, [slug, recruitmentId]);
  // 기능 `submit`(event): 먼저 `event.preventDefault();`를 실행한다.
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setMessage("연결을 확인하고 다시 시도해주세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setPending(false);`를 실행한다.
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(slug)}/applications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recruitmentId, answer }) });
      const data = await response.json();
      // 선택 조건 `response.ok`: 참이면 `"지원서가 접수되었습니다."`, 거짓이면 `data.message || "지원서를 접수하지 못했습니다."`를 사용한다.
      // 단락 분기 `data.message`: 거짓인 경우에만 오른쪽 `"지원서를 접수하지 못했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      setMessage(response.ok ? "지원서가 접수되었습니다." : data.message || "지원서를 접수하지 못했습니다.");
      // 조건 `response.ok`: 참이면 먼저 `setAnswer("");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (response.ok) { setAnswer(""); setStatus("SUBMITTED"); }
    } catch { setMessage("연결을 확인하고 다시 시도해주세요."); } finally { setPending(false); }
  }
  // 조건 `status`: 참이면 `<p role="status">지원 상태: {({ SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as Record<string, string>)[status] ?? status}</p>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `({ SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as Record<string, string>)[status]`: null 또는 undefined인 경우에만 오른쪽 `status`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (status) return <p role="status">지원 상태: {({ SUBMITTED: "접수", IN_REVIEW: "검토 중", ACCEPTED: "승인", REJECTED: "거절", CANCELLED: "취소" } as Record<string, string>)[status] ?? status}</p>;
  // 조건 `!open`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!open) return null;
  // 기능 `콜백`(event): `setAnswer(event.target.value)` 평가 결과를 반환한다.
  // 선택 조건 `pending`: 참이면 `"접수 중"`, 거짓이면 `"지원하기"`를 사용한다.
  // 단락 분기 `message`: 참인 경우에만 오른쪽 `<p role="status">{message}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <form className="auth-form" onSubmit={submit}><label>지원 동기와 자기소개<textarea required maxLength={2000} rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><button className="button button-dark" disabled={pending}>{pending ? "접수 중" : "지원하기"}</button>{message && <p role="status">{message}</p>}</form>;
}
