"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FinderActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: "close" | "delete") {
    if (!window.confirm(action === "close" ? "이 글을 종료할까요? 종료 후에는 수정할 수 없습니다." : "이 글을 삭제할까요?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/finder/${id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      else { if (action === "delete") router.push("/me"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  return <div className="market-actions">{active && <button className="button" type="button" disabled={busy} onClick={() => run("close")}>글 종료</button>}<button className="button" type="button" disabled={busy} onClick={() => run("delete")}>글 삭제</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
