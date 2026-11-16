/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs, invitations } from "@/lib/db/schema";
import { errorResponse } from "@/lib/api";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 관리자의 초대 코드 폐기 요청을 처리한다.
// 기능 `POST`(request, context): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const user = await getCurrentUser(await headers());
  // 조건 `!user?.emailVerified || user.status !== "ACTIVE_STUDENT" || user.role !== "admin"`: 참이면 `errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user?.emailVerified || user.status !== "ACTIVE_STUDENT"`: 거짓인 경우에만 오른쪽 `user.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!user?.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user?.emailVerified || user.status !== "ACTIVE_STUDENT" || user.role !== "admin") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  const { id } = await context.params;
  // 조건 `!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)`: 참이면 `errorResponse("NOT_FOUND", "초대 코드를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "초대 코드를 찾을 수 없습니다.", 404);
  // 기능 `콜백`(tx): 먼저 `const [item] = await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.id, id), isNull(invitations.revokedAt), isNull(invitations.redeemedAt))).returning({ id: invitations.id });`를 실행한다.
  const revoked = await getDb().transaction(async (tx) => {
    const [item] = await tx.update(invitations).set({ revokedAt: new Date() }).where(and(eq(invitations.id, id), isNull(invitations.revokedAt), isNull(invitations.redeemedAt))).returning({ id: invitations.id });
    // 조건 `item`: 참이면 먼저 `await tx.insert(auditLogs).values({ actorId: user.id, action: "invitation.revoked", entityType: "invitation", entityId: item.id });`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (item) await tx.insert(auditLogs).values({ actorId: user.id, action: "invitation.revoked", entityType: "invitation", entityId: item.id });
    return item;
  });
  // 조건 `!revoked`: 참이면 `errorResponse("NOT_FOUND", "폐기할 수 있는 초대 코드를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!revoked) return errorResponse("NOT_FOUND", "폐기할 수 있는 초대 코드를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
