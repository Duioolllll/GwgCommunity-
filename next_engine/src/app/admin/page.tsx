/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { AdminPanel } from "@/components/AdminPanel";

// 활성 학생 상태인 관리자에게만 관리 패널을 렌더링한다.
// 기능 `AdminPage`(): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export default async function AdminPage() {
  const user = await getCurrentUser(await headers());
  // 조건 `!user || user.role !== "admin" || user.status !== "ACTIVE_STUDENT"`: 참이면 `<div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">ADMIN</p><h1>접근 권한이 없습니다.</h1><p>관리자 계정으로 로그인해야 합니다.</p></div></div>`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user || user.role !== "admin"`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!user`: 거짓인 경우에만 오른쪽 `user.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user || user.role !== "admin" || user.status !== "ACTIVE_STUDENT") return <div className="auth-page page-shell"><div className="auth-card"><p className="eyebrow">ADMIN</p><h1>접근 권한이 없습니다.</h1><p>관리자 계정으로 로그인해야 합니다.</p></div></div>;
  return <AdminPanel />;
}
