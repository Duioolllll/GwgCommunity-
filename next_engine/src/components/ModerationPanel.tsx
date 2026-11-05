"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
type Report = { id: string; targetType: string; targetId: string; reason: string; status: "OPEN" | "REVIEWED" | "RESOLVED"; createdAt: string };
type Post = { reviewToken: string; id: string; kind: string; title: string; category: string; color: string; generalLocation: string; occurredAt: string };
type Media = { id: string; contentType: string; size: number; createdAt: string; marketPostId: string | null; finderPostId: string | null };
export function ModerationPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [r, f, m] = await Promise.all([fetch("/api/admin/reports", { cache: "no-store" }), fetch("/api/admin/finder", { cache: "no-store" }), fetch("/api/admin/media", { cache: "no-store" })]);
    if (!r.ok || !f.ok || !m.ok) throw new Error();
    setReports((await r.json()).reports); setPosts((await f.json()).posts); setMedia((await m.json()).media);
  }
  useEffect(() => { void refresh().catch(() => setError("검토 목록을 불러오지 못했습니다.")); }, []);
  async function change(url: string, body: object) {
    setBusy(true); setError("");
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { const result = await response.json(); setError(result.message ?? "처리하지 못했습니다."); }
      await refresh();
    } catch { setError("서버에 연결할 수 없습니다."); }
    finally { setBusy(false); }
  }
  return <section aria-label="신고 및 콘텐츠 검토"><h2>신고 검토</h2><p>최근 신고 100건을 표시합니다.</p>{error && <p className="form-error" role="alert">{error}</p>}{reports.length === 0 ? <p>신고가 없습니다.</p> : <ul>{reports.map(r => <li key={r.id}><p>{r.targetType} · {r.targetId} · {r.status}</p><p>{r.reason}</p>{r.status === "OPEN" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "REVIEWED" })}>검토 중</button>}{r.status !== "RESOLVED" && <button type="button" disabled={busy} onClick={() => change(`/api/admin/reports/${r.id}`, { from: r.status, to: "RESOLVED" })}>처리 완료</button>}</li>)}</ul>}<h2>분실물 공개 검토</h2><p>승인 대기 중인 최근 100건을 표시합니다. 정확한 위치와 개인정보가 포함되지 않았는지 확인하세요.</p>{posts.length === 0 ? <p>검토할 게시물이 없습니다.</p> : <ul>{posts.map(p => <li key={p.id}><p>{p.kind === "lost" ? "분실" : "습득"} · {p.title} · {p.category} · {p.color} · {p.generalLocation} · {p.occurredAt}</p><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "APPROVED", reviewToken: p.reviewToken })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/finder/${p.id}`, { decision: "REJECTED", reviewToken: p.reviewToken })}>거절</button></li>)}</ul>}<h2>이미지 검토</h2><p>게시물에 첨부된 대기 이미지의 내용을 확인한 뒤 공개 여부를 결정합니다.</p>{media.length === 0 ? <p>검토할 이미지가 없습니다.</p> : <ul>{media.map(item => <li key={item.id}><Image unoptimized src={`/api/media/${item.id}`} alt="검토 대기 이미지" width={120} height={120} /> <span>{item.contentType} · {(item.size / 1024).toFixed(0)}KB</span><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "APPROVED" })}>승인</button><button type="button" disabled={busy} onClick={() => change(`/api/admin/media/${item.id}`, { decision: "REJECTED" })}>거절</button></li>)}</ul>}</section>;
}
