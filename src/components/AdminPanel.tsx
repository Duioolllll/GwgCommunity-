"use client";

import { useState } from "react";

export function AdminPanel() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function generate() {
    setError("");
    const response = await fetch("/api/admin/invitations", { method: "POST" });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? "발급에 실패했습니다.");
    else setCode(data.code);
  }
  return <div className="subpage page-shell"><p className="eyebrow">ADMIN / INVITATIONS</p><h1>초대 코드 관리</h1><p className="muted-copy">코드는 발급 직후 안전한 개인 채널로 전달하세요. 원문은 다시 조회할 수 없습니다.</p><div className="admin-action"><button className="button button-dark" onClick={generate}>새 초대 코드 발급</button>{code && <code>{code}</code>}{error && <p className="form-error">{error}</p>}</div></div>;
}
