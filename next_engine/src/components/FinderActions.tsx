/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 기능 `FinderActions`({ id, active }): 먼저 `const router = useRouter();`를 실행한다.
export function FinderActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 종료와 삭제는 확인 후 다른 HTTP 메서드로 요청하며 삭제 시 마이페이지로 이동한다.
  // 기능 `run`(action): `!window.confirm(action === "close" ? "이 글을 종료할까요? 종료 후에는 수정할 수 없습니다." : "이 글을 삭제할까요?")` 조건을 추가로 검사한다.
  async function run(action: "close" | "delete") {
    // 조건 `!window.confirm(action === "close" ? "이 글을 종료할까요? 종료 후에는 수정할 수 없습니다." : "이 글을 삭제할까요?")`: 참이면 값 없이 현재 함수를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 선택 조건 `action === "close"`: 참이면 `"이 글을 종료할까요? 종료 후에는 수정할 수 없습니다."`, 거짓이면 `"이 글을 삭제할까요?"`를 사용한다.
    if (!window.confirm(action === "close" ? "이 글을 종료할까요? 종료 후에는 수정할 수 없습니다." : "이 글을 삭제할까요?")) return;
    setBusy(true); setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("연결할 수 없습니다. 다시 시도하세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      // 선택 조건 `action === "delete"`: 참이면 `{ method: "DELETE" }`, 거짓이면 `{ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }`를 사용한다.
      const response = await fetch(`/api/finder/${id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(result.message ?? "처리하지 못했습니다.");`를 실행한다. 거짓이면 `action === "delete"` 조건을 추가로 검사한다.
      // 단락 분기 `result.message`: null 또는 undefined인 경우에만 오른쪽 `"처리하지 못했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      // 조건 `action === "delete"`: 참이면 먼저 `router.push("/me");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (!response.ok) setError(result.message ?? "처리하지 못했습니다.");
      else { if (action === "delete") router.push("/me"); router.refresh(); }
    } catch { setError("연결할 수 없습니다. 다시 시도하세요."); }
    finally { setBusy(false); }
  }
  // 단락 분기 `active`: 참인 경우에만 오른쪽 `<button className="button" type="button" disabled={busy} onClick={() => run("close")}>글 종료</button>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `run("close")` 평가 결과를 반환한다.
  // 기능 `콜백`(): `run("delete")` 평가 결과를 반환한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div className="market-actions">{active && <button className="button" type="button" disabled={busy} onClick={() => run("close")}>글 종료</button>}<button className="button" type="button" disabled={busy} onClick={() => run("delete")}>글 삭제</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
