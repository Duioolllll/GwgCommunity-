/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { auditLogs, invitations, user } from "@/lib/db/schema";

// 기능 `constructor`(code): 먼저 `super(code);`를 실행한다.
export class InvitationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "INVALID_INVITATION" | "NOT_ELIGIBLE") {
    super(code);
  }
}

// 비밀키 길이를 확인하고 초대 코드의 HMAC을 생성한다.
// 기능 `digest`(code, secret): `Buffer.byteLength(secret, "utf8") < 32` 조건을 추가로 검사한다.
function digest(code: string, secret: string) {
  // 조건 `Buffer.byteLength(secret, "utf8") < 32`: 참이면 `new Error("INVITATION_SECRET must contain at least 32 bytes")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("INVITATION_SECRET must contain at least 32 bytes");
  return createHmac("sha256", secret).update(code).digest("hex");
}

/** The raw code is returned once and is never stored in the database or audit log. */
// 관리자 자격을 확인해 7일 유효 코드를 발급하고 해시와 감사 기록을 저장한다.
// 기능 `issueInvitation`(db, adminId, secret): 먼저 `const code = randomBytes(16).toString("hex");`를 실행한다.
export async function issueInvitation(db: Database, adminId: string, secret: string) {
  const code = randomBytes(16).toString("hex");
  const codeHash = digest(code, secret);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  // 기능 `콜백`(tx): 먼저 `const [admin] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, adminId), eq(user.role, "admin"), eq(user.status, "ACTIVE_STUDENT")));`를 실행한다.
  return db.transaction(async (tx) => {
    const [admin] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, adminId), eq(user.role, "admin"), eq(user.status, "ACTIVE_STUDENT")));
    // 조건 `!admin`: 참이면 `new InvitationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!admin) throw new InvitationError("FORBIDDEN");
    const [invitation] = await tx.insert(invitations).values({ codeHash, issuedBy: adminId, expiresAt }).returning({ id: invitations.id });
    await tx.insert(auditLogs).values({ actorId: adminId, action: "invitation.issued", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id, code, expiresAt };
  });
}

/** Conditional updates and the transaction make code consumption and activation atomic. */
// 미사용·미철회·미만료 코드를 소비하고 이메일 인증 계정을 원자적으로 활성화한다.
// 기능 `redeemInvitation`(db, userId, code, secret): 먼저 `const codeHash = digest(code.trim(), secret);`를 실행한다.
export async function redeemInvitation(db: Database, userId: string, code: string, secret: string) {
  const codeHash = digest(code.trim(), secret);
  // 기능 `콜백`(tx): 먼저 `const [invitation] = await tx.update(invitations) .set({ redeemedAt: new Date(), redeemedBy: userId }) .where(and(eq(invitations.codeHash, codeHash), isNull(invitations.redeemedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date()))) .returning({ id: invitations.id });`를 실행한다.
  return db.transaction(async (tx) => {
    const [invitation] = await tx.update(invitations)
      .set({ redeemedAt: new Date(), redeemedBy: userId })
      .where(and(eq(invitations.codeHash, codeHash), isNull(invitations.redeemedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
      .returning({ id: invitations.id });
    // 조건 `!invitation`: 참이면 `new InvitationError("INVALID_INVITATION")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!invitation) throw new InvitationError("INVALID_INVITATION");
    const [activated] = await tx.update(user).set({ status: "ACTIVE_STUDENT", updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.emailVerified, true), eq(user.status, "VERIFIED_PENDING_INVITE")))
      .returning({ id: user.id });
    // 조건 `!activated`: 참이면 `new InvitationError("NOT_ELIGIBLE")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!activated) throw new InvitationError("NOT_ELIGIBLE");
    await tx.insert(auditLogs).values({ actorId: userId, action: "invitation.redeemed", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id };
  });
}
