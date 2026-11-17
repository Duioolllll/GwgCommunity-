"use client";

import { useEffect, useState } from "react";
import { ModerationPanel } from "./ModerationPanel";

type Invitation = { id: string; createdAt: string; expiresAt: string; redeemedAt: string | null; revokedAt: string | null };

// 초대 발급과 계정 관리를 할 수 있는 관리자 화면을 만든다.
export function AdminPanel() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  // 서버에서 최신 관리 목록을 다시 읽어 화면에 반영한다.
  async function refresh() {
    const response = await fetch("/api/admin/invitations", { cache: "no-store" });
    // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
    if (!response.ok) { setError("초대 코드 목록을 불러오지 못했습니다."); return; }
    setInvitations((await response.json()).invitations);
  }
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  useEffect(() => { void refresh().catch(() => setError("서버에 연결할 수 없습니다.")); }, []);
  // 발급 원문은 응답에서만 표시하고, 목록은 발급·폐기 이후 다시 불러온다.
  // generate 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  async function generate() {
    setError("");
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다.
    try {
      const response = await fetch("/api/admin/invitations", { method: "POST" });
      const data = await response.json();
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError(data.message ?? "발급에 실패했습니다.");
      else { setCode(data.code); await refresh(); }
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  // revoke 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
  async function revoke(id: string) {
    setError("");
    // 아래 작업을 시도한다. 실패하면 실패한 이유를 화면에 표시한다.
    try {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" });
      // 서버가 요청을 처리하지 못하면 오류 안내를 보여준다. 성공하면 삭제 여부에 따라 목록으로 이동하거나 현재 화면을 새로 불러온다.
      if (!response.ok) setError("코드를 폐기하지 못했습니다.");
      await refresh();
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  // 초대 코드이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 오류이 있거나 조건에 맞을 때만 해당 화면을 보여준다.
  // 선택 기준: 초대 목록의 개수 또는 길이 = 0. 맞으면 해당 화면을 사용하고, 아니면 해당 화면을 사용한다.
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  // 선택 기준: 현재 항목의 사용 시각 있음 또는 true. 맞으면 “사용됨” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
  // 선택 기준: 현재 항목의 폐기 시각 있음 또는 true. 맞으면 “폐기됨” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  return <div className="subpage page-shell"><p className="eyebrow">ADMIN / INVITATIONS</p><h1>초대 코드 관리</h1><p className="muted-copy">코드는 발급 직후 안전한 개인 채널로 전달하세요. 원문은 다시 조회할 수 없습니다.</p><div className="admin-action"><button className="button button-dark" onClick={generate}>새 초대 코드 발급</button>{code && <code>{code}</code>}{error && <p className="form-error" role="alert">{error}</p>}</div><h2>최근 발급 내역</h2>{invitations.length === 0 ? <p>발급 내역이 없습니다.</p> : <ul>{invitations.map((item) => <li key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} 발급 · {item.redeemedAt ? "사용됨" : item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"}</span>{!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && <button type="button" onClick={() => revoke(item.id)}>폐기</button>}</li>)}</ul>}<ModerationPanel /></div>;
}
