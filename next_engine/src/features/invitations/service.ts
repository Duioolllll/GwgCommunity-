import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { auditLogs, invitations, user } from "@/lib/db/schema";

// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class InvitationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "INVALID_INVITATION" | "NOT_ELIGIBLE") {
    super(code);
  }
}

// 비밀키 길이를 확인하고 초대 코드의 HMAC을 생성한다.
// 초대 코드 원문을 그대로 저장하지 않도록 비밀키를 이용해 비교용 값으로 바꾼다.
function digest(code: string, secret: string) {
  // 확인할 조건: 비밀키의 바이트 길이 < 32. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("INVITATION_SECRET must contain at least 32 bytes");
  return createHmac("sha256", secret).update(code).digest("hex");
}

/** 초대 코드 원문은 발급 직후 한 번만 보여준다. 데이터베이스와 관리 기록에는 원문을 남기지 않는다. */
// 관리자 이용 조건을 확인해 7일 유효 코드를 발급하고 해시와 감사 기록을 저장한다.
// 관리자 자격을 확인하고 한 번만 쓸 수 있는 초대 코드를 발급한다.
export async function issueInvitation(db: Database, adminId: string, secret: string) {
  const code = randomBytes(16).toString("hex");
  const codeHash = digest(code, secret);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async (tx) => {
    const [admin] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, adminId), eq(user.role, "admin"), eq(user.status, "ACTIVE_STUDENT")));
    // 인증된 관리자 계정을 찾지 못하면 초대 코드 발급을 거절한다.
    if (!admin) throw new InvitationError("FORBIDDEN");
    const [invitation] = await tx.insert(invitations).values({ codeHash, issuedBy: adminId, expiresAt }).returning({ id: invitations.id });
    await tx.insert(auditLogs).values({ actorId: adminId, action: "invitation.issued", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id, code, expiresAt };
  });
}

/** 코드 사용과 학생 인증을 한 묶음으로 저장한다. 하나라도 실패하면 두 작업 모두 취소한다. */
// 미사용·미철회·미만료 코드를 소비하고 이메일 인증 계정을 일부만 저장되는 일이 없도록 활성화한다.
// 초대 코드의 유효기간과 사용 여부를 확인한 뒤 학생 인증을 완료한다.
export async function redeemInvitation(db: Database, userId: string, code: string, secret: string) {
  const codeHash = digest(code.trim(), secret);
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async (tx) => {
    const [invitation] = await tx.update(invitations)
      .set({ redeemedAt: new Date(), redeemedBy: userId })
      .where(and(eq(invitations.codeHash, codeHash), isNull(invitations.redeemedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
      .returning({ id: invitations.id });
    // 코드가 틀렸거나 이미 사용·폐기되었거나 만료되었다면 학생 인증을 진행하지 않는다.
    if (!invitation) throw new InvitationError("INVALID_INVITATION");
    const [activated] = await tx.update(user).set({ status: "ACTIVE_STUDENT", updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.emailVerified, true), eq(user.status, "VERIFIED_PENDING_INVITE")))
      .returning({ id: user.id });
    // 이메일 인증을 마치고 초대 코드 입력을 기다리는 계정만 학생으로 바꾼다. 바꾸지 못하면 코드 사용 기록도 함께 취소한다.
    if (!activated) throw new InvitationError("NOT_ELIGIBLE");
    await tx.insert(auditLogs).values({ actorId: userId, action: "invitation.redeemed", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id };
  });
}
