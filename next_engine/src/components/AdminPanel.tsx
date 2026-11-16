/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";

import { useEffect, useState } from "react";
import { ModerationPanel } from "./ModerationPanel";

type Invitation = { id: string; createdAt: string; expiresAt: string; redeemedAt: string | null; revokedAt: string | null };

// 기능 `AdminPanel`(): 먼저 `const [code, setCode] = useState("");`를 실행한다.
export function AdminPanel() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  // 기능 `refresh`(): 먼저 `const response = await fetch("/api/admin/invitations", { cache: "no-store" });`를 실행한다.
  async function refresh() {
    const response = await fetch("/api/admin/invitations", { cache: "no-store" });
    // 조건 `!response.ok`: 참이면 먼저 `setError("초대 코드 목록을 불러오지 못했습니다.");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!response.ok) { setError("초대 코드 목록을 불러오지 못했습니다."); return; }
    setInvitations((await response.json()).invitations);
  }
  // 기능 `콜백`(): 먼저 `void refresh().catch(() => setError("서버에 연결할 수 없습니다."));`를 실행한다.
  // 기능 `콜백`(): `setError("서버에 연결할 수 없습니다.")` 평가 결과를 반환한다.
  useEffect(() => { void refresh().catch(() => setError("서버에 연결할 수 없습니다.")); }, []);
  // 발급 원문은 응답에서만 표시하고, 목록은 발급·폐기 이후 다시 조회한다.
  // 기능 `generate`(): 먼저 `setError("");`를 실행한다.
  async function generate() {
    setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("서버에 연결할 수 없습니다.");`를 실행한다.
    try {
      const response = await fetch("/api/admin/invitations", { method: "POST" });
      const data = await response.json();
      // 조건 `!response.ok`: 참이면 먼저 `setError(data.message ?? "발급에 실패했습니다.");`를 실행한다. 거짓이면 먼저 `setCode(data.code);`를 실행한다.
      // 단락 분기 `data.message`: null 또는 undefined인 경우에만 오른쪽 `"발급에 실패했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!response.ok) setError(data.message ?? "발급에 실패했습니다.");
      else { setCode(data.code); await refresh(); }
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  // 기능 `revoke`(id): 먼저 `setError("");`를 실행한다.
  async function revoke(id: string) {
    setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("서버에 연결할 수 없습니다.");`를 실행한다.
    try {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, { method: "POST" });
      // 조건 `!response.ok`: 참이면 먼저 `setError("코드를 폐기하지 못했습니다.");`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      if (!response.ok) setError("코드를 폐기하지 못했습니다.");
      await refresh();
    } catch { setError("서버에 연결할 수 없습니다."); }
  }
  // 단락 분기 `code`: 참인 경우에만 오른쪽 `<code>{code}</code>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `invitations.length === 0`: 참이면 `<p>발급 내역이 없습니다.</p>`, 거짓이면 `<ul>{invitations.map((item) => <li key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} 발급 · {item.redeemedAt ? "사용됨" : item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"}</span>{!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && <button type="button" onClick={() => revoke(item.id)}>폐기</button>}</li>)}</ul>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} 발급 · {item.redeemedAt ? "사용됨" : item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"}</span>{!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && <button type="button" onClick={() => revoke(item.id)}>폐기</button>}</li>` 평가 결과를 반환한다.
  // 선택 조건 `item.redeemedAt`: 참이면 `"사용됨"`, 거짓이면 `item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"`를 사용한다.
  // 선택 조건 `item.revokedAt`: 참이면 `"폐기됨"`, 거짓이면 `new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"`를 사용한다.
  // 선택 조건 `new Date(item.expiresAt).getTime() <= Date.now()`: 참이면 `"만료됨"`, 거짓이면 `"사용 가능"`를 사용한다.
  // 단락 분기 `!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now()`: 참인 경우에만 오른쪽 `<button type="button" onClick={() => revoke(item.id)}>폐기</button>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!item.redeemedAt && !item.revokedAt`: 참인 경우에만 오른쪽 `new Date(item.expiresAt).getTime() > Date.now()`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!item.redeemedAt`: 참인 경우에만 오른쪽 `!item.revokedAt`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `revoke(item.id)` 평가 결과를 반환한다.
  return <div className="subpage page-shell"><p className="eyebrow">ADMIN / INVITATIONS</p><h1>초대 코드 관리</h1><p className="muted-copy">코드는 발급 직후 안전한 개인 채널로 전달하세요. 원문은 다시 조회할 수 없습니다.</p><div className="admin-action"><button className="button button-dark" onClick={generate}>새 초대 코드 발급</button>{code && <code>{code}</code>}{error && <p className="form-error" role="alert">{error}</p>}</div><h2>최근 발급 내역</h2>{invitations.length === 0 ? <p>발급 내역이 없습니다.</p> : <ul>{invitations.map((item) => <li key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("ko-KR")} 발급 · {item.redeemedAt ? "사용됨" : item.revokedAt ? "폐기됨" : new Date(item.expiresAt).getTime() <= Date.now() ? "만료됨" : "사용 가능"}</span>{!item.redeemedAt && !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && <button type="button" onClick={() => revoke(item.id)}>폐기</button>}</li>)}</ul>}<ModerationPanel /></div>;
}
