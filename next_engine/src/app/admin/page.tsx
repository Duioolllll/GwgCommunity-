import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { AdminPanel } from "@/components/AdminPanel";

// 활성 학생 상태인 관리자에게만 관리 패널을 렌더링한다.
// 이 주소에서 보여줄 화면에 필요한 자료를 준비하고 화면을 만든다.
export default async function AdminPage() {
  const user = await getCurrentUser(await headers());
  // 확인할 조건: ((사용자 없음 또는 false) 또는 (사용자의 권한 ≠ “관리자”)) 또는 (사용자의 상태 ≠ “인증된 학생”). 해당하면 해당 화면을 돌려준다.
  if (!user || user.role !== "admin" || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">ADMIN</p><h1>접근 권한이 없습니다.</h1><p>관리자 계정으로 로그인해야 합니다.</p></div></div>;
  return <AdminPanel />;
}
