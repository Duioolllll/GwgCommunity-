import { and, desc, eq } from "drizzle-orm";
import { auditLogs, clubPosts, clubs, finderPosts, marketPosts, reports, user } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type TargetType = "market" | "finder" | "club_post";
export type ReportState = "OPEN" | "REVIEWED" | "RESOLVED";
export type Approval = "APPROVED" | "REJECTED";
export class ModerationError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}
export function parseReport(body: Record<string, unknown> | null) {
  if (!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId) || typeof body.reason !== "string") return null;
  const reason = body.reason.trim();
  if (!reason || reason.length > 1000) return null;
  return { targetType: body.targetType as TargetType, targetId: body.targetId, reason };
}
async function requireActor(db: Database, id: string, admin = false) {
  const [actor] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, id), eq(user.emailVerified, true), eq(user.status, "ACTIVE_STUDENT"), admin ? eq(user.role, "admin") : undefined));
  if (!actor) throw new ModerationError("FORBIDDEN");
}
export async function createReport(db: Database, actorId: string, input: NonNullable<ReturnType<typeof parseReport>>) {
  return db.transaction(async tx => {
    await requireActor(tx, actorId);
    let owner: string | undefined;
    if (input.targetType === "market") {
      const [target] = await tx.select({ owner: marketPosts.ownerId }).from(marketPosts).where(eq(marketPosts.id, input.targetId)).for("update");
      owner = target?.owner;
    } else if (input.targetType === "finder") {
      const [target] = await tx.select({ owner: finderPosts.ownerId }).from(finderPosts).where(and(eq(finderPosts.id, input.targetId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))).for("update");
      owner = target?.owner;
    } else {
      const [target] = await tx.select({ owner: clubPosts.authorId }).from(clubPosts).innerJoin(clubs, eq(clubs.id, clubPosts.clubId)).where(and(eq(clubPosts.id, input.targetId), eq(clubPosts.isPublic, true), eq(clubs.isPublic, true))).for("update");
      owner = target?.owner;
    }
    if (!owner) throw new ModerationError("NOT_FOUND");
    if (owner === actorId) throw new ModerationError("FORBIDDEN");
    const [report] = await tx.insert(reports).values({ ...input, reporterId: actorId }).returning({ id: reports.id });
    await tx.insert(auditLogs).values({ actorId, action: "report.created", entityType: "report", entityId: report.id });
    return report;
  });
}
export async function listReports(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  return db.select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId, reason: reports.reason, status: reports.status, createdAt: reports.createdAt }).from(reports).orderBy(desc(reports.createdAt), desc(reports.id)).limit(100);
}
export async function listPendingFinder(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  return db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, createdAt: finderPosts.createdAt }).from(finderPosts).where(and(eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(100);
}
export async function updateReport(db: Database, actorId: string, id: string, from: ReportState, to: ReportState) {
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(reports).set({ status: to }).where(and(eq(reports.id, id), eq(reports.status, from))).returning({ id: reports.id });
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `report.${from.toLowerCase()}_to_${to.toLowerCase()}`, entityType: "report", entityId: id });
    return changed;
  });
}
export async function reviewFinder(db: Database, actorId: string, id: string, decision: Approval) {
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(finderPosts).set({ publicApproval: decision }).where(and(eq(finderPosts.id, id), eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).returning({ id: finderPosts.id });
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `finder.${decision.toLowerCase()}`, entityType: "finder_post", entityId: id });
    return changed;
  });
}
