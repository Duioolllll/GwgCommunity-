/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 기능 `SignOut`(): 먼저 `const router = useRouter();`를 실행한다.
export function SignOut() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 로그아웃 성공 후 홈으로 이동하고 서버에서 읽는 세션 화면을 갱신한다.
  // 기능 `signOut`(): 먼저 `setBusy(true);`를 실행한다.
  async function signOut() {
    setBusy(true); setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("로그아웃하지 못했습니다. 다시 시도해 주세요.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      // 조건 `!response.ok`: 참이면 `new Error()` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (!response.ok) throw new Error();
      router.push("/"); router.refresh();
    } catch { setError("로그아웃하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  // 선택 조건 `busy`: 참이면 `"로그아웃 중…"`, 거짓이면 `"로그아웃"`를 사용한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return <div><button className="filter-chip" type="button" disabled={busy} onClick={signOut}>{busy ? "로그아웃 중…" : "로그아웃"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
