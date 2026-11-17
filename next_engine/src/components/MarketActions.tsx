"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "reserve" | "cancel" | "complete" | "delete";
// 예약·취소·완료·삭제 버튼을 만든다.
export function MarketActions({ id, actions }: { id: string; actions: Action[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const labels: Record<Action, string> = { reserve: "거래 신청하기", cancel: "예약 취소", complete: "거래 완료", delete: "상품 삭제" };
  // 예약 생성, 상태 변경, 삭제는 각각 다른 API 경로와 메서드를 사용한다.
  // 사용자가 누른 버튼에 맞는 요청을 보내고 결과를 화면에 반영한다.
  async function run(action: Action) {
    // 삭제 확인창에서 취소를 누르면 서버에 삭제 요청을 보내지 않는다.
    if (action === "delete" && !window.confirm("상품을 삭제할까요?")) return;
    setBusy(true); setError("");
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      // 예약·삭제·상태 변경 중 사용자가 고른 작업에 맞는 서버 주소를 선택한다.
      const url = action === "reserve" ? `/api/market/${id}/reservations` : action === "delete" ? `/api/market/${id}` : `/api/market/${id}/status`;
      // 예약은 등록 요청, 삭제는 삭제 요청, 취소·완료는 수정 요청으로 보낸다. 취소·완료일 때는 선택한 작업을 JSON 자료에 담는다.
      const response = await fetch(url, { method: action === "reserve" ? "POST" : action === "delete" ? "DELETE" : "PATCH", ...(action === "cancel" || action === "complete" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) } : {}) });
      const result = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      // 삭제에 성공하면 거래 목록으로 이동한다. 다른 작업도 최신 상태가 보이도록 화면을 새로 불러온다.
      else { if (action === "delete") router.push("/market"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 허용된 작업의 버튼만 보여준다. 요청 중에는 버튼을 잠시 막고 오류가 있으면 안내 문장을 함께 표시한다.
  return <div className="market-actions">{actions.map((action) => <button key={action} className={action === "reserve" || action === "complete" ? "button button-dark" : "filter-chip"} type="button" disabled={busy} onClick={() => run(action)}>{labels[action]}</button>)}{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
