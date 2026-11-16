/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { auditLogs, invitations, session, user } from "@/lib/db/schema";

// 관리자가 사용자 상태 변경을 요청한다.
// 기능 `POST`(request, context): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const actor = await getCurrentUser(await headers());
  // 조건 `!actor`: 참이면 `errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!actor) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  // 조건 `!actor.emailVerified || actor.role !== "admin" || actor.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!actor.emailVerified || actor.role !== "admin"`: 거짓인 경우에만 오른쪽 `actor.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!actor.emailVerified`: 거짓인 경우에만 오른쪽 `actor.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!actor.emailVerified || actor.role !== "admin" || actor.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  const body = await jsonBody(request);
  // 조건 `body?.action !== "suspend" && body?.action !== "unsuspend"`: 참이면 `errorResponse("INVALID_INPUT", "정지 또는 해제를 선택하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `body?.action !== "suspend"`: 참인 경우에만 오른쪽 `body?.action !== "unsuspend"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (body?.action !== "suspend" && body?.action !== "unsuspend") return errorResponse("INVALID_INPUT", "정지 또는 해제를 선택하세요.", 400);
  // 조건 `id === actor.id`: 참이면 `errorResponse("FORBIDDEN", "자신의 계정은 정지하거나 해제할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (id === actor.id) return errorResponse("FORBIDDEN", "자신의 계정은 정지하거나 해제할 수 없습니다.", 403);
  // 기능 `콜백`(tx): 먼저 `const [admin] = await tx.select().from(user).where(eq(user.id, actor.id)).for("update");`를 실행한다.
  const result = await getDb().transaction(async (tx) => {
    const [admin] = await tx.select().from(user).where(eq(user.id, actor.id)).for("update");
    // 조건 `!admin?.emailVerified || admin.role !== "admin" || admin.status !== "ACTIVE_STUDENT"`: 참이면 `"forbidden" as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `!admin?.emailVerified || admin.role !== "admin"`: 거짓인 경우에만 오른쪽 `admin.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!admin?.emailVerified`: 거짓인 경우에만 오른쪽 `admin.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (!admin?.emailVerified || admin.role !== "admin" || admin.status !== "ACTIVE_STUDENT") return "forbidden" as const;
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    // 조건 `!target`: 참이면 `"missing" as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!target) return "missing" as const;
    // 조건 `(body.action === "suspend") === (target.status === "SUSPENDED")`: 참이면 `"conflict" as const`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if ((body.action === "suspend") === (target.status === "SUSPENDED")) return "conflict" as const;
    let status: "SUSPENDED" | "UNVERIFIED_EMAIL" | "VERIFIED_PENDING_INVITE" | "ACTIVE_STUDENT" = "SUSPENDED";
    // 조건 `body.action === "unsuspend"`: 참이면 먼저 `const [redeemed] = await tx.select({ id: invitations.id }).from(invitations).where(eq(invitations.redeemedBy, id)).limit(1);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (body.action === "unsuspend") {
      const [redeemed] = await tx.select({ id: invitations.id }).from(invitations).where(eq(invitations.redeemedBy, id)).limit(1);
      // 선택 조건 `!target.emailVerified`: 참이면 `"UNVERIFIED_EMAIL"`, 거짓이면 `redeemed ? "ACTIVE_STUDENT" : "VERIFIED_PENDING_INVITE"`를 사용한다.
      // 선택 조건 `redeemed`: 참이면 `"ACTIVE_STUDENT"`, 거짓이면 `"VERIFIED_PENDING_INVITE"`를 사용한다.
      status = !target.emailVerified ? "UNVERIFIED_EMAIL" : redeemed ? "ACTIVE_STUDENT" : "VERIFIED_PENDING_INVITE";
    }
    await tx.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, id));
    // 조건 `body.action === "suspend"`: 참이면 먼저 `await tx.delete(session).where(eq(session.userId, id));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (body.action === "suspend") await tx.delete(session).where(eq(session.userId, id));
    // 선택 조건 `body.action === "suspend"`: 참이면 `"user.suspended"`, 거짓이면 `"user.unsuspended"`를 사용한다.
    await tx.insert(auditLogs).values({ actorId: actor.id, action: body.action === "suspend" ? "user.suspended" : "user.unsuspended", entityType: "user", entityId: id });
    return status;
  });
  // 조건 `result === "forbidden"`: 참이면 `errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (result === "forbidden") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  // 조건 `result === "missing"`: 참이면 `errorResponse("NOT_FOUND", "회원을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (result === "missing") return errorResponse("NOT_FOUND", "회원을 찾을 수 없습니다.", 404);
  // 조건 `result === "conflict"`: 참이면 `errorResponse("CONFLICT", "이미 요청한 상태입니다.", 409)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (result === "conflict") return errorResponse("CONFLICT", "이미 요청한 상태입니다.", 409);
  return NextResponse.json({ status: result }, { headers: { "Cache-Control": "no-store" } });
}
