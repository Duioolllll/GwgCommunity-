import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs, invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 관리자의 초대 코드 폐기 요청을 처리한다.
// 등록 요청을 받아 초대 코드 처리를 하고 결과를 돌려준다.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  // 확인할 조건: ((사용자의 이메일 인증 여부 없음 또는 false) 또는 (사용자의 상태 ≠ “인증된 학생”)) 또는 (사용자의 권한 ≠ “관리자”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!user?.emailVerified || user.status !== "ACTIVE_STUDENT" || user.role !== "admin") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "초대 코드를 찾을 수 없습니다.", 404);
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  const revoked = await getDb().transaction(async (tx) => {
    const [item] = await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.id, id), isNull(invitations.revokedAt), isNull(invitations.redeemedAt))).returning({ id: invitations.id });
    // 확인할 조건: 현재 항목 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (item) await tx.insert(auditLogs).values({ actorId: user.id, action: "invitation.revoked", entityType: "invitation", entityId: item.id });
    return item;
  });
  // 확인할 조건: revoked 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!revoked) return errorResponse("NOT_FOUND", "폐기할 수 있는 초대 코드를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
