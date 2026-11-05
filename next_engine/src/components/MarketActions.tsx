"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "reserve" | "cancel" | "complete" | "delete";
export function MarketActions({ id, actions }: { id: string; actions: Action[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const labels: Record<Action, string> = { reserve: "거래 신청하기", cancel: "예약 취소", complete: "거래 완료", delete: "상품 삭제" };
  async function run(action: Action) {
    if (action === "delete" && !window.confirm("상품을 삭제할까요?")) return;
    setBusy(true); setError("");
    try {
      const url = action === "reserve" ? `/api/market/${id}/reservations` : action === "delete" ? `/api/market/${id}` : `/api/market/${id}/status`;
      const response = await fetch(url, { method: action === "reserve" ? "POST" : action === "delete" ? "DELETE" : "PATCH", ...(action === "cancel" || action === "complete" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) } : {}) });
      const result = await response.json();
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      else { if (action === "delete") router.push("/market"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 잠시 후 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  return <div className="market-actions">{actions.map((action) => <button key={action} className={action === "reserve" || action === "complete" ? "button button-dark" : "filter-chip"} type="button" disabled={busy} onClick={() => run(action)}>{labels[action]}</button>)}{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
