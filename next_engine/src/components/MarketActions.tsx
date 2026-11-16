/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "reserve" | "cancel" | "complete" | "delete";
// 기능 `MarketActions`({ id, actions }): 먼저 `const router = useRouter();`를 실행한다.
export function MarketActions({ id, actions }: { id: string; actions: Action[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const labels: Record<Action, string> = { reserve: "거래 신청하기", cancel: "예약 취소", complete: "거래 완료", delete: "상품 삭제" };
  // 예약 생성, 상태 전환, 삭제는 각각 다른 API 경로와 메서드를 사용한다.
  // 기능 `run`(action): `action === "delete" && !window.confirm("상품을 삭제할까요?")` 조건을 추가로 검사한다.
  async function run(action: Action) {
    // 조건 `action === "delete" && !window.confirm("상품을 삭제할까요?")`: 참이면 값 없이 현재 함수를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `action === "delete"`: 참인 경우에만 오른쪽 `!window.confirm("상품을 삭제할까요?")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (action === "delete" && !window.confirm("상품을 삭제할까요?")) return;
    setBusy(true); setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("연결할 수 없습니다. 잠시 후 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      // 선택 조건 `action === "reserve"`: 참이면 ``/api/market/${id}/reservations``, 거짓이면 `action === "delete" ? `/api/market/${id}` : `/api/market/${id}/status``를 사용한다.
      // 선택 조건 `action === "delete"`: 참이면 ``/api/market/${id}``, 거짓이면 ``/api/market/${id}/status``를 사용한다.
      const url = action === "reserve" ? `/api/market/${id}/reservations` : action === "delete" ? `/api/market/${id}` : `/api/market/${id}/status`;
      // 선택 조건 `action === "reserve"`: 참이면 `"POST"`, 거짓이면 `action === "delete" ? "DELETE" : "PATCH"`를 사용한다.
      // 선택 조건 `action === "delete"`: 참이면 `"DELETE"`, 거짓이면 `"PATCH"`를 사용한다.
      // 선택 조건 `action === "cancel" || action === "complete"`: 참이면 `{ headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }`, 거짓이면 `{}`를 사용한다.
      // 단락 분기 `action === "cancel"`: 거짓인 경우에만 오른쪽 `action === "complete"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      const response = await fetch(url, { method: action === "reserve" ? "POST" : action === "delete" ? "DELETE" : "PATCH", ...(action === "cancel" || action === "complete" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) } : {}) });
      const result = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(result.message ?? "처리하지 못했습니다.");`를 실행한다. 거짓이면 `action === "delete"` 조건을 추가로 검사한다.
      // 단락 분기 `result.message`: null 또는 undefined인 경우에만 오른쪽 `"처리하지 못했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      // 조건 `action === "delete"`: 참이면 먼저 `router.push("/market");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      else { if (action === "delete") router.push("/market"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 기능 `콜백`(action): `<button key={action} className={action === "reserve" || action === "complete" ? "button button-dark" : "filter-chip"} type="button" disabled={busy} onClick={() => run(action)}>{labels[action]}</button>` 평가 결과를 반환한다.
  // 선택 조건 `action === "reserve" || action === "complete"`: 참이면 `"button button-dark"`, 거짓이면 `"filter-chip"`를 사용한다.
  // 단락 분기 `action === "reserve"`: 거짓인 경우에만 오른쪽 `action === "complete"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `run(action)` 평가 결과를 반환한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="market-actions">{actions.map((action) => <button key={action} className={action === "reserve" || action === "complete" ? "button button-dark" : "filter-chip"} type="button" disabled={busy} onClick={() => run(action)}>{labels[action]}</button>)}{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
