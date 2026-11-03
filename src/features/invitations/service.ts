import { createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { auditLogs, invitations, user } from "@/lib/db/schema";

export class InvitationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "INVALID_INVITATION" | "NOT_ELIGIBLE") {
    super(code);
  }
}

function digest(code: string, secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("INVITATION_SECRET must contain at least 32 bytes");
  return createHmac("sha256", secret).update(code).digest("hex");
}

/** The raw code is returned once and is never stored in the database or audit log. */
export async function issueInvitation(db: Database, adminId: string, secret: string) {
  const code = randomBytes(16).toString("hex");
  const codeHash = digest(code, secret);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const [admin] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, adminId), eq(user.role, "admin"), eq(user.status, "ACTIVE_STUDENT")));
    if (!admin) throw new InvitationError("FORBIDDEN");
    const [invitation] = await tx.insert(invitations).values({ codeHash, issuedBy: adminId, expiresAt }).returning({ id: invitations.id });
    await tx.insert(auditLogs).values({ actorId: adminId, action: "invitation.issued", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id, code, expiresAt };
  });
}

/** Conditional updates and the transaction make code consumption and activation atomic. */
export async function redeemInvitation(db: Database, userId: string, code: string, secret: string) {
  const codeHash = digest(code.trim(), secret);
  return db.transaction(async (tx) => {
    const [invitation] = await tx.update(invitations)
      .set({ redeemedAt: new Date(), redeemedBy: userId })
      .where(and(eq(invitations.codeHash, codeHash), isNull(invitations.redeemedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
      .returning({ id: invitations.id });
    if (!invitation) throw new InvitationError("INVALID_INVITATION");
    const [activated] = await tx.update(user).set({ status: "ACTIVE_STUDENT", updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.emailVerified, true), eq(user.status, "VERIFIED_PENDING_INVITE")))
      .returning({ id: user.id });
    if (!activated) throw new InvitationError("NOT_ELIGIBLE");
    await tx.insert(auditLogs).values({ actorId: userId, action: "invitation.redeemed", entityType: "invitation", entityId: invitation.id });
    return { id: invitation.id };
  });
}
