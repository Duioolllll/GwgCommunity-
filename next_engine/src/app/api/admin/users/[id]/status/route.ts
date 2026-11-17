import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { auditLogs, invitations, session, user } from "@/lib/db/schema";

// 관리자가 사용자 상태 변경을 요청한다.
// 등록 요청을 받아 해당 기능 처리를 하고 결과를 돌려준다.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const actor = await getCurrentUser(await headers());
  // 확인할 조건: 요청한 사용자 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!actor) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  // 확인할 조건: ((요청한 사용자의 이메일 인증 여부 없음 또는 false) 또는 (요청한 사용자의 권한 ≠ “관리자”)) 또는 (요청한 사용자의 상태 ≠ “인증된 학생”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!actor.emailVerified || actor.role !== "admin" || actor.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  const body = await jsonBody(request);
  // 확인할 조건: (요청 내용의 선택한 작업 ≠ “suspend”) 그리고 (요청 내용의 선택한 작업 ≠ “unsuspend”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (body?.action !== "suspend" && body?.action !== "unsuspend") return errorResponse("INVALID_INPUT", "정지 또는 해제를 선택하세요.", 400);
  // 확인할 조건: 고유 번호 = 요청한 사용자의 고유 번호. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (id === actor.id) return errorResponse("FORBIDDEN", "자신의 계정은 정지하거나 해제할 수 없습니다.", 403);
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  const result = await getDb().transaction(async (tx) => {
    const [admin] = await tx.select().from(user).where(eq(user.id, actor.id)).for("update");
    // 확인할 조건: ((관리자의 이메일 인증 여부 없음 또는 false) 또는 (관리자의 권한 ≠ “관리자”)) 또는 (관리자의 상태 ≠ “인증된 학생”). 해당하면 “forbidden” 값을 돌려준다.
    if (!admin?.emailVerified || admin.role !== "admin" || admin.status !== "ACTIVE_STUDENT") return "forbidden" as const;
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    // 확인할 조건: 처리 대상 없음 또는 false. 해당하면 “missing” 값을 돌려준다.
    if (!target) return "missing" as const;
    if ((body.action === "suspend") === (target.status === "SUSPENDED")) return "conflict" as const;
    let status: "SUSPENDED" | "UNVERIFIED_EMAIL" | "VERIFIED_PENDING_INVITE" | "ACTIVE_STUDENT" = "SUSPENDED";
    // 확인할 조건: 요청 내용의 선택한 작업 = “unsuspend”. 해당하면 이 경우에 필요한 자료를 준비한다.
    if (body.action === "unsuspend") {
      const [redeemed] = await tx.select({ id: invitations.id }).from(invitations).where(eq(invitations.redeemedBy, id)).limit(1);
      // 선택 기준: 처리 대상의 이메일 인증 여부 없음 또는 false. 맞으면 “이메일 미인증” 값을 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
      // 선택 기준: redeemed 있음 또는 true. 맞으면 “인증된 학생” 값을 사용하고, 아니면 “VERIFIED_PENDING_INVITE” 값을 사용한다.
      status = !target.emailVerified ? "UNVERIFIED_EMAIL" : redeemed ? "ACTIVE_STUDENT" : "VERIFIED_PENDING_INVITE";
    }
    await tx.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, id));
    // 확인할 조건: 요청 내용의 선택한 작업 = “suspend”. 해당하면 아래에 있는 작업을 실행한다.
    if (body.action === "suspend") await tx.delete(session).where(eq(session.userId, id));
    // 선택 기준: 요청 내용의 선택한 작업 = “suspend”. 맞으면 “user.suspended” 값을 사용하고, 아니면 “user.unsuspended” 값을 사용한다.
    await tx.insert(auditLogs).values({ actorId: actor.id, action: body.action === "suspend" ? "user.suspended" : "user.unsuspended", entityType: "user", entityId: id });
    return status;
  });
  // 확인할 조건: 처리 결과 = “forbidden”. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (result === "forbidden") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  // 확인할 조건: 처리 결과 = “missing”. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (result === "missing") return errorResponse("NOT_FOUND", "회원을 찾을 수 없습니다.", 404);
  // 확인할 조건: 처리 결과 = “conflict”. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (result === "conflict") return errorResponse("CONFLICT", "이미 요청한 상태입니다.", 409);
  return NextResponse.json({ status: result }, { headers: { "Cache-Control": "no-store" } });
}
