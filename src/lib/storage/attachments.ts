import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import { finderPosts, marketPosts, mediaAssets, postMedia } from "@/lib/db/schema";
import type { FinderInput } from "@/features/finder/posts";
import type { marketInput } from "@/features/market/data";
import type { ObjectStore } from "./r2";

export const imageIdsInput = z.array(z.string().uuid()).max(4).refine(ids => new Set(ids).size === ids.length);
export class InvalidAttachments extends Error {}
async function attach(tx: Database, ownerId: string, ids: string[], target: { marketPostId: string } | { finderPostId: string }) {
  if (!ids.length) return;
  // Lock asset rows so concurrent attempts serialize before the unique link is checked.
  const assets = await tx.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.ownerId, ownerId))).orderBy(mediaAssets.id).for("update");
  if (assets.length !== ids.length) throw new InvalidAttachments();
  const linked = await tx.select({ id: postMedia.mediaId }).from(postMedia).where(inArray(postMedia.mediaId, ids));
  if (linked.length) throw new InvalidAttachments();
  await tx.insert(postMedia).values(ids.map(mediaId => ({ mediaId, ...target })));
}
export async function createMarketWithImages(db: Database, ownerId: string, input: z.infer<typeof marketInput>, ids: string[]) {
  return db.transaction(async tx => { const [post] = await tx.insert(marketPosts).values({ ...input, ownerId }).returning({ id: marketPosts.id }); await attach(tx, ownerId, ids, { marketPostId: post.id }); return post; });
}
export async function createFinderWithImages(db: Database, ownerId: string, input: FinderInput, ids: string[]) {
  return db.transaction(async tx => { const [post] = await tx.insert(finderPosts).values({ ...input, ownerId }).returning({ id: finderPosts.id, kind: finderPosts.kind, title: finderPosts.title, category: finderPosts.category, color: finderPosts.color, generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt, status: finderPosts.status }); await attach(tx, ownerId, ids, { finderPostId: post.id }); return post; });
}
// Market posts have no approval field. Until one exists, an explicitly approved asset is the publication gate.
export async function visibleImages(db: Database, target: "market" | "finder", ids: string[], viewerId?: string) {
  if (!ids.length) return [];
  const rows = await db.select({ id: mediaAssets.id, marketPostId: postMedia.marketPostId, finderPostId: postMedia.finderPostId }).from(postMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, postMedia.mediaId)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId))
    .where(and(target === "market" ? inArray(postMedia.marketPostId, ids) : inArray(postMedia.finderPostId, ids), or(
      viewerId ? and(eq(mediaAssets.ownerId, viewerId), or(eq(marketPosts.ownerId, viewerId), eq(finderPosts.ownerId, viewerId))) : undefined,
      and(eq(mediaAssets.moderation, "APPROVED"), target === "market" ? eq(marketPosts.ownerId, mediaAssets.ownerId) : and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE")))
    )));
  return rows;
}
export async function readVisibleImage(db: Database, store: ObjectStore, id: string, viewerId?: string) {
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).leftJoin(postMedia, eq(postMedia.mediaId, mediaAssets.id)).leftJoin(marketPosts, eq(marketPosts.id, postMedia.marketPostId)).leftJoin(finderPosts, eq(finderPosts.id, postMedia.finderPostId)).where(and(eq(mediaAssets.id, id), or(
    viewerId ? eq(mediaAssets.ownerId, viewerId) : undefined,
    and(eq(mediaAssets.moderation, "APPROVED"), or(eq(marketPosts.ownerId, mediaAssets.ownerId), and(eq(finderPosts.ownerId, mediaAssets.ownerId), eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.status, "ACTIVE"))))
  )));
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
