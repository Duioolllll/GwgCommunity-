import Link from "next/link";
import { cookies } from "next/headers";
import { getUser } from "@/lib/store";

export default async function MePage() {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">MY PAGE</p><h1>로그인이 필요합니다.</h1><p>학생 전용 기능을 이용하려면 먼저 로그인하세요.</p><Link className="button button-dark" href="/auth/login">로그인하기</Link></div></div>;
  return <div className="subpage page-shell"><p className="eyebrow">MY PAGE</p><h1>{user.nickname}님, 안녕하세요.</h1><p className="muted-copy">{user.email} · {user.role === "admin" ? "관리자" : "학생"}</p><div className="quick-grid"><Link className="quick-card" href="/market/new">Market 상품 등록 <span>↗</span></Link><Link className="quick-card" href="/finder/new">Finder 분실물 등록 <span>↗</span></Link></div></div>;
}
