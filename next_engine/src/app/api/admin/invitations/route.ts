import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { issueInvitation } from "@/features/invitations/service";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// admin 함수는 아래 작업을 한 곳에 모아 필요할 때 다시 실행할 수 있게 한다.
async function admin() {
  const user = await getCurrentUser(await headers());
  // 선택 기준: ((사용자의 이메일 인증 여부 있음 또는 true) 그리고 (사용자의 상태 = “인증된 학생”)) 그리고 (사용자의 권한 = “관리자”). 맞으면 사용자를 사용하고, 아니면 값 없음을 사용한다.
  return user?.emailVerified && user.status === "ACTIVE_STUDENT" && user.role === "admin" ? user : null;
}

// 관리자가 초대 코드를 발급한다.
// 등록 요청을 받아 초대 코드 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await admin();
  // 로그인한 사용자를 찾지 못하면 로그인이 필요하다고 알리고 요청을 거절한다.
  if (!user) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const secret = process.env.INVITATION_SECRET;
  // 확인할 조건: 비밀키 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!secret) throw new Error("INVITATION_SECRET is required");
  const invitation = await issueInvitation(getDb(), user.id, secret);
  return NextResponse.json(invitation, { status: 201, headers: { "Cache-Control": "no-store" } });
}

// 관리자가 초대 코드 목록을 불러온다.
// 조회 요청을 받아 초대 코드 처리를 하고 결과를 돌려준다.
export async function GET() {
  // 확인할 조건: 관리자 처리 결과 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!await admin()) return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const rows = await getDb().select({ id: invitations.id, issuedBy: invitations.issuedBy, createdAt: invitations.createdAt, expiresAt: invitations.expiresAt, redeemedAt: invitations.redeemedAt, revokedAt: invitations.revokedAt }).from(invitations).orderBy(desc(invitations.createdAt)).limit(100);
  return NextResponse.json({ invitations: rows }, { headers: { "Cache-Control": "no-store" } });
}
