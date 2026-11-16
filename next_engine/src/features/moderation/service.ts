/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { FinderInput } from "@/features/finder/posts";
import { auditLogs, clubPosts, clubs, finderPosts, marketPosts, mediaAssets, postMedia, reports, user } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type TargetType = "market" | "finder" | "club_post";
export type ReportState = "OPEN" | "REVIEWED" | "RESOLVED";
export type Approval = "APPROVED" | "REJECTED";
// 기능 `constructor`(code): 먼저 `super(code);`를 실행한다.
export class ModerationError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}
// 기능 `parseReport`(body): `!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId) || typeof body.reason !== "string"` 조건을 추가로 검사한다.
export function parseReport(body: Record<string, unknown> | null) {
  // 조건 `!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId) || typeof body.reason !== "string"`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId)`: 거짓인 경우에만 오른쪽 `typeof body.reason !== "string"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string"`: 거짓인 경우에만 오른쪽 `!uuidPattern.test(body.targetId)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!body || !["market", "finder", "club_post"].includes(String(body.targetType))`: 거짓인 경우에만 오른쪽 `typeof body.targetId !== "string"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!body`: 거짓인 경우에만 오른쪽 `!["market", "finder", "club_post"].includes(String(body.targetType))`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!body || !["market", "finder", "club_post"].includes(String(body.targetType)) || typeof body.targetId !== "string" || !uuidPattern.test(body.targetId) || typeof body.reason !== "string") return null;
  const reason = body.reason.trim();
  // 조건 `!reason || reason.length > 1000`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!reason`: 거짓인 경우에만 오른쪽 `reason.length > 1000`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!reason || reason.length > 1000) return null;
  return { targetType: body.targetType as TargetType, targetId: body.targetId, reason };
}
// 기능 `requireActor`(db, id, admin): 먼저 `const [actor] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, id), eq(user.emailVerified, true), eq(user.status, "ACTIVE_STUDENT"), admin ? eq(user.role, "admin") : undefined));`를 실행한다.
async function requireActor(db: Database, id: string, admin = false) {
  // 선택 조건 `admin`: 참이면 `eq(user.role, "admin")`, 거짓이면 `undefined`를 사용한다.
  const [actor] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, id), eq(user.emailVerified, true), eq(user.status, "ACTIVE_STUDENT"), admin ? eq(user.role, "admin") : undefined));
  // 조건 `!actor`: 참이면 `new ModerationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!actor) throw new ModerationError("FORBIDDEN");
}
// 신고를 생성한다.
// 기능 `createReport`(db, actorId, input): `db.transaction(async tx => { await requireActor(tx, actorId); let owner: string | undefined; if (input.targetType === "market") { const [target] = await tx.select({ owner: marketPosts.ownerId }).from(marketPosts).where(eq(marketPosts.id, input.targetId)).for("update"); owner = target?.owner; } else if (input.targetType === "finder") { const [target] = await tx.select({ owner: finderPosts.ownerId }).from(finderPosts).where(and(eq(finderPosts.id, input.targetId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))).for("update"); owner = target?.owner; } else { const [target] = await tx.select({ owner: clubPosts.authorId }).from(clubPosts).innerJoin(clubs, eq(clubs.id, clubPosts.clubId)).where(and(eq(clubPosts.id, input.targetId), eq(clubPosts.isPublic, true), eq(clubs.isPublic, true))).for("update"); owner = target?.owner; } if (!owner) throw new ModerationError("NOT_FOUND"); if (owner === actorId) throw new ModerationError("FORBIDDEN"); const [report] = await tx.insert(reports).values({ ...input, reporterId: actorId }).returning({ id: reports.id }); await tx.insert(auditLogs).values({ actorId, action: "report.created", entityType: "report", entityId: report.id }); return report; })`를 반환한다.
export async function createReport(db: Database, actorId: string, input: NonNullable<ReturnType<typeof parseReport>>) {
  // 기능 `콜백`(tx): 먼저 `await requireActor(tx, actorId);`를 실행한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId);
    let owner: string | undefined;
    // 조건 `input.targetType === "market"`: 참이면 먼저 `const [target] = await tx.select({ owner: marketPosts.ownerId }).from(marketPosts).where(eq(marketPosts.id, input.targetId)).for("update");`를 실행한다. 거짓이면 `input.targetType === "finder"` 조건을 추가로 검사한다.
    // 조건 `input.targetType === "finder"`: 참이면 먼저 `const [target] = await tx.select({ owner: finderPosts.ownerId }).from(finderPosts).where(and(eq(finderPosts.id, input.targetId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))).for("update");`를 실행한다. 거짓이면 먼저 `const [target] = await tx.select({ owner: clubPosts.authorId }).from(clubPosts).innerJoin(clubs, eq(clubs.id, clubPosts.clubId)).where(and(eq(clubPosts.id, input.targetId), eq(clubPosts.isPublic, true), eq(clubs.isPublic, true))).for("update");`를 실행한다.
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
    // 조건 `!owner`: 참이면 `new ModerationError("NOT_FOUND")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!owner) throw new ModerationError("NOT_FOUND");
    // 조건 `owner === actorId`: 참이면 `new ModerationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (owner === actorId) throw new ModerationError("FORBIDDEN");
    const [report] = await tx.insert(reports).values({ ...input, reporterId: actorId }).returning({ id: reports.id });
    await tx.insert(auditLogs).values({ actorId, action: "report.created", entityType: "report", entityId: report.id });
    return report;
  });
}
// 관리용 신고 목록을 조회한다.
// 기능 `listReports`(db, actorId): 먼저 `await requireActor(db, actorId, true);`를 실행한다.
export async function listReports(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  return db.select({ id: reports.id, targetType: reports.targetType, targetId: reports.targetId, reason: reports.reason, status: reports.status, createdAt: reports.createdAt }).from(reports).orderBy(desc(reports.createdAt), desc(reports.id)).limit(100);
}
// 심사 대기 중인 분실물 목록을 조회한다.
// 기능 `listPendingFinder`(db, actorId): 먼저 `await requireActor(db, actorId, true);`를 실행한다.
export async function listPendingFinder(db: Database, actorId: string) {
  await requireActor(db, actorId, true);
  const posts = await db.select({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, createdAt: finderPosts.createdAt }).from(finderPosts).where(and(eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).orderBy(desc(finderPosts.createdAt), desc(finderPosts.id)).limit(100);
  // 기능 `콜백`(post): `({ ...post, reviewToken: finderReviewToken(post) })` 평가 결과를 반환한다.
  return posts.map(post => ({ ...post, reviewToken: finderReviewToken(post) }));
}
// 기능 `finderReviewToken`(post): `createHash("sha256").update(JSON.stringify([post.id, post.kind, post.title, post.category, post.color, post.generalLocation, post.occurredAt])).digest("hex")`를 반환한다.
function finderReviewToken(post: FinderInput & { id: string }) {
  // Hash only the content shown to the reviewer, in a stable order.
  return createHash("sha256").update(JSON.stringify([post.id, post.kind, post.title, post.category, post.color, post.generalLocation, post.occurredAt])).digest("hex");
}
// 신고 상태 변경을 처리한다.
// 기능 `updateReport`(db, actorId, id, from, to): `db.transaction(async tx => { await requireActor(tx, actorId, true); const [changed] = await tx.update(reports).set({ status: to }).where(and(eq(reports.id, id), eq(reports.status, from))).returning({ id: reports.id }); if (!changed) throw new ModerationError("CONFLICT"); await tx.insert(auditLogs).values({ actorId, action: `report.${from.toLowerCase()}_to_${to.toLowerCase()}`, entityType: "report", entityId: id }); return changed; })`를 반환한다.
export async function updateReport(db: Database, actorId: string, id: string, from: ReportState, to: ReportState) {
  // 기능 `콜백`(tx): 먼저 `await requireActor(tx, actorId, true);`를 실행한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(reports).set({ status: to }).where(and(eq(reports.id, id), eq(reports.status, from))).returning({ id: reports.id });
    // 조건 `!changed`: 참이면 `new ModerationError("CONFLICT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `report.${from.toLowerCase()}_to_${to.toLowerCase()}`, entityType: "report", entityId: id });
    return changed;
  });
}
// 분실물 공개 심사 결정을 처리한다.
// 기능 `reviewFinder`(db, actorId, id, decision, reviewToken): `db.transaction(async tx => { await requireActor(tx, actorId, true); const [post] = await tx.select().from(finderPosts).where(eq(finderPosts.id, id)).for("update"); if (!post || post.publicApproval !== "PENDING" || post.status !== "ACTIVE" || finderReviewToken(post) !== reviewToken) throw new ModerationError("CONFLICT"); const [changed] = await tx.update(finderPosts).set({ publicApproval: decision }).where(and(eq(finderPosts.id, id), eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).returning({ id: finderPosts.id }); if (!changed) throw new ModerationError("CONFLICT"); await tx.insert(auditLogs).values({ actorId, action: `finder.${decision.toLowerCase()}`, entityType: "finder_post", entityId: id }); return changed; })`를 반환한다.
export async function reviewFinder(db: Database, actorId: string, id: string, decision: Approval, reviewToken: string) {
  // 기능 `콜백`(tx): 먼저 `await requireActor(tx, actorId, true);`를 실행한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [post] = await tx.select().from(finderPosts).where(eq(finderPosts.id, id)).for("update");
    // 조건 `!post || post.publicApproval !== "PENDING" || post.status !== "ACTIVE" || finderReviewToken(post) !== reviewToken`: 참이면 `new ModerationError("CONFLICT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `!post || post.publicApproval !== "PENDING" || post.status !== "ACTIVE"`: 거짓인 경우에만 오른쪽 `finderReviewToken(post) !== reviewToken`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!post || post.publicApproval !== "PENDING"`: 거짓인 경우에만 오른쪽 `post.status !== "ACTIVE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `!post`: 거짓인 경우에만 오른쪽 `post.publicApproval !== "PENDING"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (!post || post.publicApproval !== "PENDING" || post.status !== "ACTIVE" || finderReviewToken(post) !== reviewToken) throw new ModerationError("CONFLICT");
    const [changed] = await tx.update(finderPosts).set({ publicApproval: decision }).where(and(eq(finderPosts.id, id), eq(finderPosts.publicApproval, "PENDING"), eq(finderPosts.status, "ACTIVE"))).returning({ id: finderPosts.id });
    // 조건 `!changed`: 참이면 `new ModerationError("CONFLICT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `finder.${decision.toLowerCase()}`, entityType: "finder_post", entityId: id });
    return changed;
  });
}

// 심사 대기 중인 이미지 목록을 조회한다.
// 기능 `listPendingMedia`(db, actorId): 먼저 `await requireActor(db, actorId, true);`를 실행한다.
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
// 기능 `reviewMedia`(db, actorId, id, decision): `db.transaction(async tx => { await requireActor(tx, actorId, true); const [changed] = await tx.update(mediaAssets) .set({ moderation: decision }) .where(and(eq(mediaAssets.id, id), eq(mediaAssets.moderation, "PENDING"))) .returning({ id: mediaAssets.id }); if (!changed) throw new ModerationError("CONFLICT"); await tx.insert(auditLogs).values({ actorId, action: `media.${decision.toLowerCase()}`, entityType: "media_asset", entityId: id }); return changed; })`를 반환한다.
export async function reviewMedia(db: Database, actorId: string, id: string, decision: Approval) {
  // 기능 `콜백`(tx): 먼저 `await requireActor(tx, actorId, true);`를 실행한다.
  return db.transaction(async tx => {
    await requireActor(tx, actorId, true);
    const [changed] = await tx.update(mediaAssets)
      .set({ moderation: decision })
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.moderation, "PENDING")))
      .returning({ id: mediaAssets.id });
    // 조건 `!changed`: 참이면 `new ModerationError("CONFLICT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!changed) throw new ModerationError("CONFLICT");
    await tx.insert(auditLogs).values({ actorId, action: `media.${decision.toLowerCase()}`, entityType: "media_asset", entityId: id });
    return changed;
  });
}
