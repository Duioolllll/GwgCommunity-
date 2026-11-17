"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 로그아웃 버튼을 만든다.
export function SignOut() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 로그아웃 성공 후 홈으로 이동하고 서버에서 읽는 세션 화면을 갱신한다.
  // 로그아웃 요청을 보내고 로그인 정보가 없는 화면으로 갱신한다.
  async function signOut() {
    setBusy(true); setError("");
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다. 성공하거나 실패한 뒤에는 반드시 작업 중인지 나타내는 화면 상태를 바꾼다.
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) throw new Error();
      router.push("/"); router.refresh();
    } catch { setError("로그아웃하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  // 선택 기준: 처리 중 표시 있음 또는 true. 맞으면 “로그아웃 중…” 값을 사용하고, 아니면 “로그아웃” 값을 사용한다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  return <div><button className="filter-chip" type="button" disabled={busy} onClick={signOut}>{busy ? "로그아웃 중…" : "로그아웃"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
