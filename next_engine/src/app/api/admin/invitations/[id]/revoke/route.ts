import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs, invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { hasTrustedOrigin } from "@/lib/auth/origin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  if (!user?.emailVerified || user.status !== "ACTIVE_STUDENT" || user.role !== "admin") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "초대 코드를 찾을 수 없습니다.", 404);
  const revoked = await getDb().transaction(async (tx) => {
    const [item] = await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.id, id), isNull(invitations.revokedAt), isNull(invitations.redeemedAt))).returning({ id: invitations.id });
    if (item) await tx.insert(auditLogs).values({ actorId: user.id, action: "invitation.revoked", entityType: "invitation", entityId: item.id });
    return item;
  });
  if (!revoked) return errorResponse("NOT_FOUND", "폐기할 수 있는 초대 코드를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
