/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { InvitationError, redeemInvitation } from "@/features/invitations/service";
import { consumeInvitationAttempt } from "@/lib/auth/invitation-attempts";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 초대 코드 사용과 학생 인증 요청을 처리한다.
// 기능 `POST`(request): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  // 조건 `!user`: 참이면 `errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  // 조건 `!user.emailVerified || user.status !== "VERIFIED_PENDING_INVITE"`: 참이면 `errorResponse("FORBIDDEN", "이메일 확인 후 초대 코드를 입력하세요.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "VERIFIED_PENDING_INVITE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user.emailVerified || user.status !== "VERIFIED_PENDING_INVITE") return errorResponse("FORBIDDEN", "이메일 확인 후 초대 코드를 입력하세요.", 403);
  // 조건 `!await consumeInvitationAttempt(getDb(), user.id)`: 참이면 `errorResponse("RATE_LIMITED", "잠시 후 다시 시도하세요.", 429)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!await consumeInvitationAttempt(getDb(), user.id)) return errorResponse("RATE_LIMITED", "잠시 후 다시 시도하세요.", 429);
  const body = await jsonBody(request);
  // 선택 조건 `typeof body?.code === "string"`: 참이면 `body.code.trim()`, 거짓이면 `""`를 사용한다.
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  // 조건 `!/^[a-f0-9]{32}$/.test(code)`: 참이면 `errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!/^[a-f0-9]{32}$/.test(code)) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
  const secret = process.env.INVITATION_SECRET;
  // 조건 `!secret`: 참이면 `new Error("INVITATION_SECRET is required")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!secret) throw new Error("INVITATION_SECRET is required");
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof InvitationError` 조건을 추가로 검사한다.
  try {
    await redeemInvitation(getDb(), user.id, code, secret);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 조건 `error instanceof InvitationError`: 참이면 `errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (error instanceof InvitationError) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
    throw error;
  }
}
