"use client";

import { useEffect, useState } from "react";
import { ModerationPanel } from "./ModerationPanel";

type Invitation = { id: string; createdAt: string; expiresAt: string; redeemedAt: string | null; revokedAt: string | null };

export function AdminPanel() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  async function refresh() {
    const response = await fetch("/api/admin/invitations", { cache: "no-store" });
    if (!response.ok) { setError("초대 코드 목록을 불러오지 못했습니다."); return; }
    setInvitations((await response.json()).invitations);
  }
  useEffect(() => { void refresh().catch(() => setError("서버에 연결할 수 없습니다.")); }, []);
  async function generate() {
    setError("");
    try {
      const response = await fetch("/api/admin/invitations", { method: "POST" });
      const data = await response.json();
      if (!response.ok) setError(data.message ?? "발급에 실패했습니다.");
      else { setCode(data.code); await refresh(); }
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  async function revoke(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" });
      if (!response.ok) setError("코드를 폐기하지 못했습니다.");
      await refresh();
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  return <div className="subpage page-shell"><p className="eyebrow">ADMIN / INVITATIONS</p><h1>초대 코드 관리</h1><p className="muted-copy">코드는 발급 직후 안전한 개인 채널로 전달하세요. 원문은 다시 조회할 수 없습니다.</p><div className="admin-action"><button className="button button-dark" onClick={generate}>새 초대 코드 발급</button>{code && <code>{code}</code>}{error && <p className="form-error" role="alert">{error}</p>}</div><h2>최근 발급 내역</h2>{invitations.length === 0 ? <p>발급 내역이 없습니다.</p> : <ul>{invitations.map((item) => <li key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} 발급 · {item.redeemedAt ? "사용됨" : item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"}</span>{!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && <button type="button" onClick={() => revoke(item.id)}>폐기</button>}</li>)}</ul>}<ModerationPanel /></div>;
}
