import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { AdminPanel } from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await getCurrentUser(await headers());
  if (!user || user.role !== "admin" || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">ADMIN</p><h1>접근 권한이 없습니다.</h1><p>관리자 계정으로 로그인해야 합니다.</p></div></div>;
  return <AdminPanel />;
}
