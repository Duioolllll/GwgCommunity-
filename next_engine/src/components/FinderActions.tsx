"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 분실물 글을 종료하거나 삭제하는 버튼을 만든다.
export function FinderActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 종료와 삭제는 확인 후 다른 HTTP 메서드로 요청하며 삭제 시 마이페이지로 이동한다.
  // 사용자가 누른 버튼에 맞는 요청을 보내고 결과를 화면에 반영한다.
  async function run(action: "close" | "delete") {
    // 확인할 조건: 확인창에서 사용자가 동의함 조건을 만족하지 않음. 해당하면 현재 작업을 그만둔다.
    // 선택 기준: 선택한 작업 = “종료”. 맞으면 “이 글을 종료할까요? 종료 후에는 수정할 수 없습니다.” 값을 사용하고, 아니면 “이 글을 삭제할까요?” 값을 사용한다.
    if (!window.confirm(action === "close" ? "이 글을 종료할까요? 종료 후에는 수정할 수 없습니다." : "이 글을 삭제할까요?")) return;
    setBusy(true); setError("");
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      // 선택 기준: 선택한 작업 = “삭제”. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
      const response = await fetch(`/api/finder/${id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      // 삭제에 성공하면 거래 목록으로 이동한다. 다른 작업도 최신 상태가 보이도록 화면을 새로 불러온다.
      else { if (action === "delete") router.push("/me"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 허용된 작업의 버튼만 보여준다. 요청 중에는 버튼을 잠시 막고 오류가 있으면 안내 문장을 함께 표시한다.
  return <div className="market-actions">{active && <button className="button" type="button" disabled={busy} onClick={() => run("close")}>글 종료</button>}<button className="button" type="button" disabled={busy} onClick={() => run("delete")}>글 삭제</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
