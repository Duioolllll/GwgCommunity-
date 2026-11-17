import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { finderPosts, marketPosts, mediaAssets, postMedia } from "@/lib/db/schema";
import type { FinderInput } from "@/features/finder/posts";
import type { marketInput } from "@/features/market/data";
import type { ObjectStore } from "./r2";

// 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
export const imageIdsInput = z.array(z.string().uuid()).max(4).refine(ids => new Set(ids).size === ids.length);
export class InvalidAttachments extends Error {}
// 현재 사용자의 이미지만 글에 연결하고 다른 글에 이미 쓰인 이미지는 막는다.
async function attach(tx: Database, ownerId: string, ids: string[], target: { marketPostId: string } | { finderPostId: string }) {
  // 확인할 조건: 이미지 번호 목록의 개수 또는 길이 없음 또는 false. 해당하면 현재 작업을 그만둔다.
  if (!ids.length) return;
  // 같은 이미지를 동시에 여러 글에 연결하지 못하도록 해당 이미지 정보를 잠근 뒤 사용 여부를 확인한다.
  const assets = await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.ownerId, ownerId))).orderBy(mediaAssets.id).for("update");
  // 확인할 조건: assets의 개수 또는 길이 ≠ 이미지 번호 목록의 개수 또는 길이. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (assets.length !== ids.length) throw new InvalidAttachments();
  const linked = await tx.select({ id: postMedia.mediaId }).from(postMedia).where(inArray(postMedia.mediaId, ids));
  // 확인할 조건: linked의 개수 또는 길이 있음 또는 true. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (linked.length) throw new InvalidAttachments();
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  await tx.insert(postMedia).values(ids.map(mediaId => ({ mediaId, ...target })));
}
// 중고 게시물과 이미지 연결을 생성한다.
// 거래 글과 첨부 이미지의 연결 정보를 함께 저장한다.
export async function createMarketWithImages(db: Database, ownerId: string, input: z.infer<typeof marketInput>, ids: string[]) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => { const [post] = await tx.insert(marketPosts).values({ ...input, ownerId }).returning({ id: marketPosts.id }); await attach(tx, ownerId, ids, { marketPostId: post.id }); return post; });
}
// 분실물 게시물과 이미지 연결을 생성한다.
// 분실물 글과 첨부 이미지의 연결 정보를 함께 저장한다.
export async function createFinderWithImages(db: Database, ownerId: string, input: FinderInput, ids: string[]) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => { const [post] = await tx.insert(finderPosts).values({ ...input, ownerId }).returning({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status }); await attach(tx, ownerId, ids, { finderPostId: post.id }); return post; });
}
// 거래 글에는 별도 승인 항목이 없으므로 첨부 이미지가 승인됐는지를 확인해 공개 여부를 정한다.
// 요청자가 볼 수 있는 게시물 이미지 목록을 불러온다.
// 공개 심사 상태와 보는 사람의 권한에 맞는 이미지만 골라낸다.
export async function visibleImages(db: Database, target: "market" | "finder", ids: string[], viewerId?: string) {
  // 확인할 조건: 이미지 번호 목록의 개수 또는 길이 없음 또는 false. 해당하면 결과가 없는 빈 목록을 돌려준다.
  if (!ids.length) return [];
  // 선택 기준: 처리 대상 = “market”. 맞으면 inArray 처리 결과를 사용하고, 아니면 inArray 처리 결과를 사용한다.
  // 선택 기준: 보는 사람의 번호 있음 또는 true. 맞으면 and 처리 결과를 사용하고, 아니면 undefined를 사용한다.
  // 선택 기준: 처리 대상 = “market”. 맞으면 eq 처리 결과를 사용하고, 아니면 and 처리 결과를 사용한다.
  const rows = await db.select({ id: mediaAssets.id, marketPostId: postMedia.marketPostId, finderPostId: postMedia.finderPostId }).from(postMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, postMedia.mediaId)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId))
    .where(and(target === "market" ? inArray(postMedia.marketPostId, ids) : inArray(postMedia.finderPostId, ids), or(
      viewerId ? and(eq(mediaAssets.ownerId, viewerId), or(eq(marketPosts.ownerId, viewerId), eq(finderPosts.ownerId, viewerId))) : undefined,
      and(eq(mediaAssets.moderation, "APPROVED"), target === "market" ? eq(marketPosts.ownerId, mediaAssets.ownerId) : and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE")))
    )));
  return rows;
}
// 이미지 공개 범위를 확인하고 저장소에서 읽는다.
// 로그인 사용자와 이미지 심사 상태를 확인한 뒤 볼 수 있는 파일만 읽는다.
export async function readVisibleImage(db: Database, store: ObjectStore, id: string, viewerId?: string, isAdmin = false) {
  // 선택 기준: 관리자 여부 있음 또는 true. 맞으면 eq 처리 결과를 사용하고, 아니면 다음 조건에 따라 고르는 값을 사용한다.
  // 선택 기준: 보는 사람의 번호 있음 또는 true. 맞으면 eq 처리 결과를 사용하고, 아니면 undefined를 사용한다.
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).leftJoin(postMedia, eq(postMedia.mediaId, mediaAssets.id)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId)).where(and(eq(mediaAssets.id, id), or(
    isAdmin ? eq(mediaAssets.id, id) : viewerId ? eq(mediaAssets.ownerId, viewerId) : undefined,
    and(eq(mediaAssets.moderation, "APPROVED"), or(eq(marketPosts.ownerId, mediaAssets.ownerId), and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))))
  )));
  // 확인할 조건: 이미지 정보 없음 또는 false. 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
