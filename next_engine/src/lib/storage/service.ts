import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { mediaAssets } from "@/lib/db/schema";
import { sanitizeImage } from "./image";
import type { ObjectStore } from "./r2";

export async function saveImage(db: Database, store: ObjectStore, ownerId: string, input: Buffer, declaredType: string) {
  const image = await sanitizeImage(input, declaredType);
  const key = `private/${randomUUID()}`;
  await store.put(key, image.data, image.contentType);
  try {
    const [asset] = await db.insert(mediaAssets).values({ ownerId, storageKey: key, contentType: image.contentType, size: image.data.length }).returning({ id: mediaAssets.id, contentType: mediaAssets.contentType, size: mediaAssets.size });
    return asset;
  } catch (error) {
    try { await store.delete(key); } catch { console.error("Failed to remove an orphaned media object after database failure"); }
    throw error;
  }
}
export async function readOwnedImage(db: Database, store: ObjectStore, ownerId: string, id: string) {
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId)));
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
