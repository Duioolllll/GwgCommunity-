import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { auditLogs, invitations, session, user } from "@/lib/db/schema";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const actor = await getCurrentUser(await headers());
  if (!actor) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (!actor.emailVerified || actor.role !== "admin" || actor.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  const body = await jsonBody(request);
  if (body?.action !== "suspend" && body?.action !== "unsuspend") return errorResponse("INVALID_INPUT", "정지 또는 해제를 선택하세요.", 400);
  if (id === actor.id) return errorResponse("FORBIDDEN", "자신의 계정은 정지하거나 해제할 수 없습니다.", 403);
  const result = await getDb().transaction(async (tx) => {
    const [admin] = await tx.select().from(user).where(eq(user.id, actor.id)).for("update");
    if (!admin?.emailVerified || admin.role !== "admin" || admin.status !== "ACTIVE_STUDENT") return "forbidden" as const;
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    if (!target) return "missing" as const;
    if ((body.action === "suspend") === (target.status === "SUSPENDED")) return "conflict" as const;
    let status: "SUSPENDED" | "UNVERIFIED_EMAIL" | "VERIFIED_PENDING_INVITE" | "ACTIVE_STUDENT" = "SUSPENDED";
    if (body.action === "unsuspend") {
      const [redeemed] = await tx.select({ id: invitations.id }).from(invitations).where(eq(invitations.redeemedBy, id)).limit(1);
      status = !target.emailVerified ? "UNVERIFIED_EMAIL" : redeemed ? "ACTIVE_STUDENT" : "VERIFIED_PENDING_INVITE";
    }
    await tx.update(user).set({ status, updatedAt: new Date() }).where(eq(user.id, id));
    if (body.action === "suspend") await tx.delete(session).where(eq(session.userId, id));
    await tx.insert(auditLogs).values({ actorId: actor.id, action: body.action === "suspend" ? "user.suspended" : "user.unsuspended", entityType: "user", entityId: id });
    return status;
  });
  if (result === "forbidden") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  if (result === "missing") return errorResponse("NOT_FOUND", "회원을 찾을 수 없습니다.", 404);
  if (result === "conflict") return errorResponse("CONFLICT", "이미 요청한 상태입니다.", 409);
  return NextResponse.json({ status: result }, { headers: { "Cache-Control": "no-store" } });
}
