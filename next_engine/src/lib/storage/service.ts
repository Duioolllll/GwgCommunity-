/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { mediaAssets } from "@/lib/db/schema";
import { sanitizeImage } from "./image";
import type { ObjectStore } from "./r2";

// 정제된 객체를 저장한 뒤 DB 기록에 실패하면 객체 삭제를 시도한다.
// 기능 `saveImage`(db, store, ownerId, input, declaredType): 먼저 `const image = await sanitizeImage(input, declaredType);`를 실행한다.
export async function saveImage(db: Database, store: ObjectStore, ownerId: string, input: Buffer, declaredType: string) {
  const image = await sanitizeImage(input, declaredType);
  const key = `private/${randomUUID()}`;
  await store.put(key, image.data, image.contentType);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `TryStatement` 구문을 실행한다.
  try {
    const [asset] = await db.insert(mediaAssets).values({ ownerId, storageKey: key, contentType: image.contentType, size: image.data.length }).returning({ id: mediaAssets.id, contentType: mediaAssets.contentType, size: mediaAssets.size });
    return asset;
  } catch (error) {
    // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `console.error("Failed to remove an orphaned media object after database failure");`를 실행한다.
    try { await store.delete(key); } catch { console.error("Failed to remove an orphaned media object after database failure"); }
    throw error;
  }
}
// 기능 `readOwnedImage`(db, store, ownerId, id): 먼저 `const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId)));`를 실행한다.
export async function readOwnedImage(db: Database, store: ObjectStore, ownerId: string, id: string) {
  const [asset] = await db.select({ storageKey: mediaAssets.storageKey, contentType: mediaAssets.contentType }).from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId)));
  // 조건 `!asset`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!asset) return null;
  return { data: await store.get(asset.storageKey), contentType: asset.contentType };
}
