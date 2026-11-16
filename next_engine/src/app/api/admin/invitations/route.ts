/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { issueInvitation } from "@/features/invitations/service";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 기능 `admin`(): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
async function admin() {
  const user = await getCurrentUser(await headers());
  // 선택 조건 `user?.emailVerified && user.status === "ACTIVE_STUDENT" && user.role === "admin"`: 참이면 `user`, 거짓이면 `null`를 사용한다.
  // 단락 분기 `user?.emailVerified && user.status === "ACTIVE_STUDENT"`: 참인 경우에만 오른쪽 `user.role === "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `user?.emailVerified`: 참인 경우에만 오른쪽 `user.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return user?.emailVerified && user.status === "ACTIVE_STUDENT" && user.role === "admin" ? user : null;
}

// 관리자가 초대 코드를 발급한다.
// 기능 `POST`(request): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await admin();
  // 조건 `!user`: 참이면 `errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const secret = process.env.INVITATION_SECRET;
  // 조건 `!secret`: 참이면 `new Error("INVITATION_SECRET is required")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!secret) throw new Error("INVITATION_SECRET is required");
  const invitation = await issueInvitation(getDb(), user.id, secret);
  return NextResponse.json(invitation, { status: 201, headers: { "Cache-Control": "no-store" } });
}

// 관리자가 초대 코드 목록을 조회한다.
// 기능 `GET`(): `!await admin()` 조건을 추가로 검사한다.
export async function GET() {
  // 조건 `!await admin()`: 참이면 `errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!await admin()) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const rows = await getDb().select({ id: invitations.id, issuedBy: invitations.issuedBy, createdAt: invitations.createdAt, expiresAt: invitations.expiresAt, redeemedAt: invitations.redeemedAt, revokedAt: invitations.revokedAt }).from(invitations).orderBy(desc(invitations.createdAt)).limit(100);
  return NextResponse.json({ invitations: rows }, { headers: { "Cache-Control": "no-store" } });
}
