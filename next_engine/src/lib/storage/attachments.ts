/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { finderPosts, marketPosts, mediaAssets, postMedia } from "@/lib/db/schema";
import type { FinderInput } from "@/features/finder/posts";
import type { marketInput } from "@/features/market/data";
import type { ObjectStore } from "./r2";

// 기능 `콜백`(ids): `new Set(ids).size === ids.length` 평가 결과를 반환한다.
export const imageIdsInput = z.array(z.string().uuid()).max(4).refine(ids => new Set(ids).size === ids.length);
export class InvalidAttachments extends Error {}
// 기능 `attach`(tx, ownerId, ids, target): `!ids.length` 조건을 추가로 검사한다.
async function attach(tx: Database, ownerId: string, ids: string[], target: { marketPostId: string } | { finderPostId: string }) {
  // 조건 `!ids.length`: 참이면 값 없이 현재 함수를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!ids.length) return;
  // Lock asset rows so concurrent attempts serialize before the unique link is checked.
  const assets = await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.ownerId, ownerId))).orderBy(mediaAssets.id).for("update");
  // 조건 `assets.length !== ids.length`: 참이면 `new InvalidAttachments()` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (assets.length !== ids.length) throw new InvalidAttachments();
  const linked = await tx.select({ id: postMedia.mediaId }).from(postMedia).where(inArray(postMedia.mediaId, ids));
  // 조건 `linked.length`: 참이면 `new InvalidAttachments()` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (linked.length) throw new InvalidAttachments();
  // 기능 `콜백`(mediaId): `({ mediaId, ...target })` 평가 결과를 반환한다.
  await tx.insert(postMedia).values(ids.map(mediaId => ({ mediaId, ...target })));
}
// 중고 게시물과 이미지 연결을 생성한다.
// 기능 `createMarketWithImages`(db, ownerId, input, ids): `db.transaction(async tx => { const [post] = await tx.insert(marketPosts).values({ ...input, ownerId }).returning({ id: marketPosts.id }); await attach(tx, ownerId, ids, { marketPostId: post.id }); return post; })`를 반환한다.
export async function createMarketWithImages(db: Database, ownerId: string, input: z.infer<typeof marketInput>, ids: string[]) {
  // 기능 `콜백`(tx): 먼저 `const [post] = await tx.insert(marketPosts).values({ ...input, ownerId }).returning({ id: marketPosts.id });`를 실행한다.
  return db.transaction(async tx => { const [post] = await tx.insert(marketPosts).values({ ...input, ownerId }).returning({ id: marketPosts.id }); await attach(tx, ownerId, ids, { marketPostId: post.id }); return post; });
}
// 분실물 게시물과 이미지 연결을 생성한다.
// 기능 `createFinderWithImages`(db, ownerId, input, ids): `db.transaction(async tx => { const [post] = await tx.insert(finderPosts).values({ ...input, ownerId }).returning({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status }); await attach(tx, ownerId, ids, { finderPostId: post.id }); return post; })`를 반환한다.
export async function createFinderWithImages(db: Database, ownerId: string, input: FinderInput, ids: string[]) {
  // 기능 `콜백`(tx): 먼저 `const [post] = await tx.insert(finderPosts).values({ ...input, ownerId }).returning({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status });`를 실행한다.
  return db.transaction(async tx => { const [post] = await tx.insert(finderPosts).values({ ...input, ownerId }).returning({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status }); await attach(tx, ownerId, ids, { finderPostId: post.id }); return post; });
}
// Market posts have no approval field. Until one exists, an explicitly approved asset is the publication gate.
// 요청자가 볼 수 있는 게시물 이미지 목록을 조회한다.
// 기능 `visibleImages`(db, target, ids, viewerId): `!ids.length` 조건을 추가로 검사한다.
export async function visibleImages(db: Database, target: "market" | "finder", ids: string[], viewerId?: string) {
  // 조건 `!ids.length`: 참이면 `[]`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!ids.length) return [];
  // 선택 조건 `target === "market"`: 참이면 `inArray(postMedia.marketPostId, ids)`, 거짓이면 `inArray(postMedia.finderPostId, ids)`를 사용한다.
  // 선택 조건 `viewerId`: 참이면 `and(eq(mediaAssets.ownerId, viewerId), or(eq(marketPosts.ownerId, viewerId), eq(finderPosts.ownerId, viewerId)))`, 거짓이면 `undefined`를 사용한다.
  // 선택 조건 `target === "market"`: 참이면 `eq(marketPosts.ownerId, mediaAssets.ownerId)`, 거짓이면 `and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))`를 사용한다.
  const rows = await db.select({ id: mediaAssets.id, marketPostId: postMedia.marketPostId, finderPostId: postMedia.finderPostId }).from(postMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, postMedia.mediaId)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId))
    .where(and(target === "market" ? inArray(postMedia.marketPostId, ids) : inArray(postMedia.finderPostId, ids), or(
      viewerId ? and(eq(mediaAssets.ownerId, viewerId), or(eq(marketPosts.ownerId, viewerId), eq(finderPosts.ownerId, viewerId))) : undefined,
      and(eq(mediaAssets.moderation, "APPROVED"), target === "market" ? eq(marketPosts.ownerId, mediaAssets.ownerId) : and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE")))
    )));
  return rows;
}
// 이미지 공개 범위를 확인하고 저장소에서 읽는다.
// 기능 `readVisibleImage`(db, store, id, viewerId, isAdmin): 먼저 `const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).leftJoin(postMedia, eq(postMedia.mediaId, mediaAssets.id)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId)).where(and(eq(mediaAssets.id, id), or( isAdmin ? eq(mediaAssets.id, id) : viewerId ? eq(mediaAssets.ownerId, viewerId) : undefined, and(eq(mediaAssets.moderation, "APPROVED"), or(eq(marketPosts.ownerId, mediaAssets.ownerId), and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE")))) )));`를 실행한다.
export async function readVisibleImage(db: Database, store: ObjectStore, id: string, viewerId?: string, isAdmin = false) {
  // 선택 조건 `isAdmin`: 참이면 `eq(mediaAssets.id, id)`, 거짓이면 `viewerId ? eq(mediaAssets.ownerId, viewerId) : undefined`를 사용한다.
  // 선택 조건 `viewerId`: 참이면 `eq(mediaAssets.ownerId, viewerId)`, 거짓이면 `undefined`를 사용한다.
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).leftJoin(postMedia, eq(postMedia.mediaId, mediaAssets.id)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId)).where(and(eq(mediaAssets.id, id), or(
    isAdmin ? eq(mediaAssets.id, id) : viewerId ? eq(mediaAssets.ownerId, viewerId) : undefined,
    and(eq(mediaAssets.moderation, "APPROVED"), or(eq(marketPosts.ownerId, mediaAssets.ownerId), and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))))
  )));
  // 조건 `!asset`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
