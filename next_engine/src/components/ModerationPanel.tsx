/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
type Report = { id: string; targetType: string; targetId: string; reason: string; status: "OPEN" | "REVIEWED" | "RESOLVED"; createdAt: string };
type Post = { reviewToken: string; id: string; kind: string; title: string; category: string; color: string; generalLocation: string; occurredAt: string };
type Media = { id: string; contentType: string; size: number; createdAt: string; marketPostId: string | null; finderPostId: string | null };
// 기능 `ModerationPanel`(): 먼저 `const [reports, setReports] = useState<Report[]>([]);`를 실행한다.
export function ModerationPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // 신고·분실물·이미지 검토 목록을 함께 조회하며 어느 하나라도 실패하면 오류로 처리한다.
  // 기능 `refresh`(): 먼저 `const [r, f, m] = await Promise.all([fetch("/api/admin/reports", { cache: "no-store" }), fetch("/api/admin/finder", { cache: "no-store" }), fetch("/api/admin/media", { cache: "no-store" })]);`를 실행한다.
  async function refresh() {
    const [r, f, m] = await Promise.all([fetch("/api/admin/reports", { cache: "no-store" }), fetch("/api/admin/finder", { cache: "no-store" }), fetch("/api/admin/media", { cache: "no-store" })]);
    // 조건 `!r.ok || !f.ok || !m.ok`: 참이면 `new Error()` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `!r.ok || !f.ok`: 거짓인 경우에만 오른쪽 `!m.ok`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!r.ok`: 거짓인 경우에만 오른쪽 `!f.ok`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (!r.ok || !f.ok || !m.ok) throw new Error();
    setReports((await r.json()).reports); setPosts((await f.json()).posts); setMedia((await m.json()).media);
  }
  // 기능 `콜백`(): 먼저 `void refresh().catch(() => setError("검토 목록을 불러오지 못했습니다."));`를 실행한다.
  // 기능 `콜백`(): `setError("검토 목록을 불러오지 못했습니다.")` 평가 결과를 반환한다.
  useEffect(() => { void refresh().catch(() => setError("검토 목록을 불러오지 못했습니다.")); }, []);
  // 분실물 검토 요청에는 목록에서 받은 reviewToken이 함께 전달된다.
  // 기능 `change`(url, body): 먼저 `setBusy(true);`를 실행한다.
  async function change(url: string, body: object) {
    setBusy(true); setError("");
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `setError("서버에 연결할 수 없습니다.");`를 실행한다. 성공·실패 모두 마지막에 먼저 `setBusy(false);`를 실행한다.
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      // 조건 `!response.ok`: 참이면 먼저 `const result = await response.json();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      // 단락 분기 `result.message`: null 또는 undefined인 경우에만 오른쪽 `"처리하지 못했습니다."`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!response.ok) { const result = await response.json(); setError(result.message ?? "처리하지 못했습니다."); }
      await refresh();
    } catch { setError("서버에 연결할 수 없습니다."); }
    finally { setBusy(false); }
  }
  // 단락 분기 `error`: 참인 경우에만 오른쪽 `<p className="form-error" role="alert">{error}</p>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 선택 조건 `reports.length === 0`: 참이면 `<p>신고가 없습니다.</p>`, 거짓이면 `<ul>{reports.map(r => <li key={r.id}><p>{r.targetType} · {r.targetId} · {r.status}</p><p>{r.reason}</p>{r.status === "OPEN" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })}>검토 중</button>}{r.status !== "RESOLVED" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })}>처리 완료</button>}</li>)}</ul>`를 사용한다.
  // 기능 `콜백`(r): `<li key={r.id}><p>{r.targetType} · {r.targetId} · {r.status}</p><p>{r.reason}</p>{r.status === "OPEN" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })}>검토 중</button>}{r.status !== "RESOLVED" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })}>처리 완료</button>}</li>` 평가 결과를 반환한다.
  // 단락 분기 `r.status === "OPEN"`: 참인 경우에만 오른쪽 `<button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })}>검토 중</button>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })` 평가 결과를 반환한다.
  // 단락 분기 `r.status !== "RESOLVED"`: 참인 경우에만 오른쪽 `<button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })}>처리 완료</button>`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 기능 `콜백`(): `change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })` 평가 결과를 반환한다.
  // 선택 조건 `posts.length === 0`: 참이면 `<p>검토할 게시물이 없습니다.</p>`, 거짓이면 `<ul>{posts.map(p => <li key={p.id}><p>{p.kind === "lost" ? "분실" : "습득"} · {p.title} · {p.category} · {p.color} · {p.generalLocation} · {p.occurredAt}</p><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "APPROVED", reviewToken: p.reviewToken })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "REJECTED", reviewToken: p.reviewToken })}>거절</button></li>)}</ul>`를 사용한다.
  // 기능 `콜백`(p): `<li key={p.id}><p>{p.kind === "lost" ? "분실" : "습득"} · {p.title} · {p.category} · {p.color} · {p.generalLocation} · {p.occurredAt}</p><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "APPROVED", reviewToken: p.reviewToken })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "REJECTED", reviewToken: p.reviewToken })}>거절</button></li>` 평가 결과를 반환한다.
  // 선택 조건 `p.kind === "lost"`: 참이면 `"분실"`, 거짓이면 `"습득"`를 사용한다.
  // 기능 `콜백`(): `change(`/api/admin/finder/${p.id}`, { decision: "APPROVED", reviewToken: p.reviewToken })` 평가 결과를 반환한다.
  // 기능 `콜백`(): `change(`/api/admin/finder/${p.id}`, { decision: "REJECTED", reviewToken: p.reviewToken })` 평가 결과를 반환한다.
  // 선택 조건 `media.length === 0`: 참이면 `<p>검토할 이미지가 없습니다.</p>`, 거짓이면 `<ul>{media.map(item => <li key={item.id}><Image unoptimized src={`/api/media/${item.id}`} alt="검토 대기 이미지" width={120} height={120} /> <span>{item.contentType} · {(item.size / 1024).toFixed(0)}KB</span><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "APPROVED" })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "REJECTED" })}>거절</button></li>)}</ul>`를 사용한다.
  // 기능 `콜백`(item): `<li key={item.id}><Image unoptimized src={`/api/media/${item.id}`} alt="검토 대기 이미지" width={120} height={120} /> <span>{item.contentType} · {(item.size / 1024).toFixed(0)}KB</span><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "APPROVED" })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "REJECTED" })}>거절</button></li>` 평가 결과를 반환한다.
  // 기능 `콜백`(): `change(`/api/admin/media/${item.id}`, { decision: "APPROVED" })` 평가 결과를 반환한다.
  // 기능 `콜백`(): `change(`/api/admin/media/${item.id}`, { decision: "REJECTED" })` 평가 결과를 반환한다.
  return <section aria-label="신고 및 콘텐츠 검토"><h2>신고 검토</h2><p>최근 신고 100건을 표시합니다.</p>{error && <p className="form-error" role="alert">{error}</p>}{reports.length === 0 ? <p>신고가 없습니다.</p> : <ul>{reports.map(r => <li key={r.id}><p>{r.targetType} · {r.targetId} · {r.status}</p><p>{r.reason}</p>{r.status === "OPEN" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })}>검토 중</button>}{r.status !== "RESOLVED" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })}>처리 완료</button>}</li>)}</ul>}<h2>분실물 공개 검토</h2><p>승인 대기 중인 최근 100건을 표시합니다. 정확한 위치와 개인정보가 포함되지 않았는지 확인하세요.</p>{posts.length === 0 ? <p>검토할 게시물이 없습니다.</p> : <ul>{posts.map(p => <li key={p.id}><p>{p.kind === "lost" ? "분실" : "습득"} · {p.title} · {p.category} · {p.color} · {p.generalLocation} · {p.occurredAt}</p><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "APPROVED", reviewToken: p.reviewToken })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "REJECTED", reviewToken: p.reviewToken })}>거절</button></li>)}</ul>}<h2>이미지 검토</h2><p>게시물에 첨부된 대기 이미지의 내용을 확인한 뒤 공개 여부를 결정합니다.</p>{media.length === 0 ? <p>검토할 이미지가 없습니다.</p> : <ul>{media.map(item => <li key={item.id}><Image unoptimized src={`/api/media/${item.id}`} alt="검토 대기 이미지" width={120} height={120} /> <span>{item.contentType} · {(item.size / 1024).toFixed(0)}KB</span><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "APPROVED" })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "REJECTED" })}>거절</button></li>)}</ul>}</section>;
}
