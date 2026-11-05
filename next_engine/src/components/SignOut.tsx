"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      router.push("/"); router.refresh();
    } catch { setError("로그아웃하지 못했습니다. 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <div><button className="filter-chip" type="button" disabled={busy} onClick={signOut}>{busy ? "로그아웃 중…" : "로그아웃"}</button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
