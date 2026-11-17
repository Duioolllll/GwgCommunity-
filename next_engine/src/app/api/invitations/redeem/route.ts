import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { InvitationError, redeemInvitation } from "@/features/invitations/service";
import { consumeInvitationAttempt } from "@/lib/auth/invitation-attempts";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 초대 코드 사용과 학생 인증 요청을 처리한다.
// 등록 요청을 받아 초대 코드 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  // 로그인한 사용자를 찾지 못하면 로그인이 필요하다고 알리고 요청을 거절한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  // 확인할 조건: (사용자의 이메일 인증 여부 없음 또는 false) 또는 (사용자의 상태 ≠ “VERIFIED_PENDING_INVITE”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!user.emailVerified || user.status !== "VERIFIED_PENDING_INVITE") return errorResponse("FORBIDDEN", "이메일 확인 후 초대 코드를 입력하세요.", 403);
  // 확인할 조건: consumeInvitationAttempt 처리 결과 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!await consumeInvitationAttempt(getDb(), user.id)) return errorResponse("RATE_LIMITED", "잠시 후 다시 시도하세요.", 429);
  const body = await jsonBody(request);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  // 확인할 조건: 초대 코드의 형식이 맞음 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!/^[a-f0-9]{32}$/.test(code)) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
  const secret = process.env.INVITATION_SECRET;
  // 확인할 조건: 비밀키 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!secret) throw new Error("INVITATION_SECRET is required");
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    await redeemInvitation(getDb(), user.id, code, secret);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 확인할 조건: 오류가 InvitationError 종류. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    if (error instanceof InvitationError) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
    throw error;
  }
}
