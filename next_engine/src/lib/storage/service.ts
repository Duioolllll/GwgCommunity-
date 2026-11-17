import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { mediaAssets } from "@/lib/db/schema";
import { sanitizeImage } from "./image";
import type { ObjectStore } from "./r2";

// 형식 정리된 객체를 저장한 뒤 DB 기록에 실패하면 객체 삭제를 시도한다.
// 이미지를 정리해 R2에 저장하고 데이터베이스에 이미지 정보를 기록한다.
export async function saveImage(db: Database, store: ObjectStore, ownerId: string, input: Buffer, declaredType: string) {
  const image = await sanitizeImage(input, declaredType);
  const key = `private/${randomUUID()}`;
  await store.put(key, image.data, image.contentType);
  // 아래 작업을 시도한다. 실패하면 아래의 처리를 이어서 실행한다.
  try {
    const [asset] = await db.insert(mediaAssets).values({ ownerId, storageKey: key, contentType: image.contentType, size: image.data.length }).returning({ id: mediaAssets.id, contentType: mediaAssets.contentType, size: mediaAssets.size });
    return asset;
  } catch (error) {
    // 이미지 정보 저장에 실패하면 R2 파일도 지워 본다. 파일 삭제도 실패하면 서버 기록에 남긴다.
    try { await store.delete(key); } catch { console.error("Failed to remove an orphaned media object after database failure"); }
    throw error;
  }
}
// 이미지 주인인지 확인한 뒤 저장된 파일을 읽는다.
export async function readOwnedImage(db: Database, store: ObjectStore, ownerId: string, id: string) {
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId)));
  // 이 사용자의 이미지가 아니거나 이미지 정보가 없으면 파일을 돌려주지 않는다.
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
