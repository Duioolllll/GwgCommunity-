import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { FinderInput } from "@/features/finder/posts";
import { auditLogs, clubPosts, clubs, finderPosts, marketPosts, mediaAssets, postMedia, reports, user } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type TargetType = "market" | "finder" | "club_post";
export type ReportState = "OPEN" | "REVIEWED" | "RESOLVED";
export type Approval = "APPROVED" | "REJECTED";
// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class ModerationError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}
// 신고 대상과 신고 이유가 올바른지 확인한다.
export function parseReport(body: Record<string, unknown> | null) {
  // 신고 대상의 종류·고유 번호·사유가 빠졌거나 정해진 형식이 아니면 접수하지 않는다.
  if (!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId) || typeof body.reason !== "string") return null;
  const reason = body.reason.trim();
  // 공백을 뺀 신고 이유가 비어 있거나 1,000자를 넘으면 접수하지 않는다.
  if (!reason || reason.length > 1000) return null;
  return { targetType: body.targetType as TargetType, targetId: body.targetId, reason };
}
// 요청한 계정이 활동 가능한지 확인하고 필요하면 관리자 권한도 확인한다.
async function requireActor(db: Database, id: string, admin = false) {
  // 이메일과 학생 인증을 마친 계정을 찾는다. 관리자 작업이면 관리자 역할도 함께 확인한다.
  const [actor] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, id), eq(user.emailVerified, true), eq(user.status, "ACTIVE_STUDENT"), admin ? eq(user.role, "admin") : undefined));
  // 필요한 자격을 갖춘 계정이 없으면 요청을 거절한다.
  if (!actor) throw new ModerationError("FORBIDDEN");
}
// 신고를 생성한다.
// 활동 가능한 사용자의 신고 내용을 저장한다.
export async function createReport(db: Database, actorId: string, input: NonNullable<ReturnType<typeof parseReport>>) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId);
    let owner: string | undefined;
    // 거래 글·분실물 글·동아리 활동 글 중 신고한 종류에서 글쓴이를 찾는다. 공개 조건도 해당 종류에 맞게 확인한다.
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
    // 신고할 수 있는 글을 찾지 못하면 대상 없음 오류를 알린다.
    if (!owner) throw new ModerationError("NOT_FOUND");
    // 자기 글을 스스로 신고하는 요청은 받지 않는다.
    if (owner === actorId) throw new ModerationError("FORBIDDEN");
    const [report] = await tx.insert(reports).values({ ...input, reporterId: actorId }).returning({ id: reports.id });
    await tx.insert(auditLogs).values({ actorId, action: "report.created", entityType: "report", entityId: report.id });
    return report;
  });
}
// 관리용 신고 목록을 불러온다.
// 관리자에게 신고 목록을 보여준다.
export async function listReports(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  return db.select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId, reason: reports.reason, status: reports.status, createdAt: reports.createdAt }).from(reports).orderBy(desc(reports.createdAt), desc(reports.id)).limit(100);
}
// 심사 대기 중인 분실물 목록을 불러온다.
// 공개 승인을 기다리는 분실물 글을 관리자에게 보여준다.
export async function listPendingFinder(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  const posts = await db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, createdAt: finderPosts.createdAt }).from(finderPosts).where(and(eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(100);
  // 관리자가 보고 있는 글의 내용이 바뀌었는지 확인할 값을 각 글에 붙여 보낸다.
  return posts.map(post => ({ ...post, reviewToken: finderReviewToken(post) }));
}
// 심사 도중 글이 바뀌었는지 알아볼 확인값을 만든다.
function finderReviewToken(post: FinderInput & { id: string }) {
  // 심사 화면에 보이는 내용을 일정한 순서로 묶어 확인값을 만든다. 글이 바뀌면 확인값도 달라진다.
  return createHash("sha256").update(JSON.stringify([post.id, post.kind, post.title, post.category, post.color, post.generalLocation, post.occurredAt])).digest("hex");
}
// 신고 상태 변경을 처리한다.
// 현재 신고 상태를 확인한 뒤 처리 상태를 바꾼다.
export async function updateReport(db: Database, actorId: string, id: string, from: ReportState, to: ReportState) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(reports).set({ status: to }).where(and(eq(reports.id, id), eq(reports.status, from))).returning({ id: reports.id });
    // 다른 요청이 먼저 처리해 상태가 달라졌다면 같은 작업을 중복 저장하지 않고 변경 충돌을 알린다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `report.${from.toLowerCase()}_to_${to.toLowerCase()}`, entityType: "report", entityId: id });
    return changed;
  });
}
// 분실물 공개 심사 결정을 처리한다.
// 심사 화면의 글이 여전히 같은 내용인지 확인하고 공개 승인 또는 거절을 저장한다.
export async function reviewFinder(db: Database, actorId: string, id: string, decision: Approval, reviewToken: string) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [post] = await tx.select().from(finderPosts).where(eq(finderPosts.id, id)).for("update");
    // 글이 없어졌거나 이미 심사·종료됐거나 심사 화면을 연 뒤 내용이 바뀌었으면 결정을 저장하지 않는다.
    if (!post || post.publicApproval !== "PENDING" || post.status !== "ACTIVE" || finderReviewToken(post) !== reviewToken) throw new ModerationError("CONFLICT");
    const [changed] = await tx.update(finderPosts).set({ publicApproval: decision }).where(and(eq(finderPosts.id, id), eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).returning({ id: finderPosts.id });
    // 다른 요청이 먼저 처리해 상태가 달라졌다면 같은 작업을 중복 저장하지 않고 변경 충돌을 알린다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `finder.${decision.toLowerCase()}`, entityType: "finder_post", entityId: id });
    return changed;
  });
}

// 심사 대기 중인 이미지 목록을 불러온다.
// 심사를 기다리는 이미지 목록을 불러온다.
export async function listPendingMedia(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  return db.select({
    id: mediaAssets.id,
    contentType: mediaAssets.contentType,
    size: mediaAssets.size,
    createdAt: mediaAssets.createdAt,
    marketPostId: postMedia.marketPostId,
    finderPostId: postMedia.finderPostId,
  }).from(mediaAssets)
    .leftJoin(postMedia, eq(postMedia.mediaId, mediaAssets.id))
    .where(eq(mediaAssets.moderation, "PENDING"))
    .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
    .limit(100);
}

// 이미지 심사 결정을 처리한다.
// 관리자가 이미지를 승인하거나 거절한 결과를 저장한다.
export async function reviewMedia(db: Database, actorId: string, id: string, decision: Approval) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(mediaAssets)
      .set({ moderation: decision })
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.moderation, "PENDING")))
      .returning({ id: mediaAssets.id });
    // 다른 요청이 먼저 처리해 상태가 달라졌다면 같은 작업을 중복 저장하지 않고 변경 충돌을 알린다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `media.${decision.toLowerCase()}`, entityType: "media_asset", entityId: id });
    return changed;
  });
}
