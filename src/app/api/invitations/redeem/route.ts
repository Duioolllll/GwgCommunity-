import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { InvitationError, redeemInvitation } from "@/features/invitations/service";
import { consumeInvitationAttempt } from "@/lib/auth/invitation-attempts";
import { hasTrustedOrigin } from "@/lib/auth/origin";

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (!user.emailVerified || user.status !== "VERIFIED_PENDING_INVITE") return errorResponse("FORBIDDEN", "이메일 확인 후 초대 코드를 입력하세요.", 403);
  if (!await consumeInvitationAttempt(getDb(), user.id)) return errorResponse("RATE_LIMITED", "잠시 후 다시 시도하세요.", 429);
  const body = await jsonBody(request);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^[a-f0-9]{32}$/.test(code)) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
  const secret = process.env.INVITATION_SECRET;
  if (!secret) throw new Error("INVITATION_SECRET is required");
  try {
    await redeemInvitation(getDb(), user.id, code, secret);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvitationError) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
    throw error;
  }
}
