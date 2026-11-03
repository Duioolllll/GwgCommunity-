import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import sharp from "sharp";
import * as schema from "../../src/lib/db/schema";
import { saveImage, readOwnedImage } from "../../src/lib/storage/service";
import { InvalidImageError, MAX_IMAGE_BYTES } from "../../src/lib/storage/image";
import { readBoundedMultipart, validOrigin, MAX_REQUEST_BYTES } from "../../src/lib/storage/request";
import type { ObjectStore } from "../../src/lib/storage/r2";

test("image upload sanitizes metadata and makes stored objects accessible only to their owner", async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const id = `media-test-${randomUUID()}`;
  const objects = new Map<string, Buffer>();
  const store: ObjectStore = { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { const value = objects.get(key); if (!value) throw new Error("missing"); return value; }, async delete(key) { objects.delete(key); } };
  try {
    await db.insert(schema.user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, status: "ACTIVE_STUDENT" });
    const original = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).jpeg().withExif({ IFD0: { Artist: "private name" } }).toBuffer();
    assert.ok((await sharp(original).metadata()).exif);
    const asset = await saveImage(db, store, id, original, "image/jpeg");
    const image = await readOwnedImage(db, store, id, asset.id);
    assert.ok(image);
    assert.equal((await sharp(image.data).metadata()).exif, undefined);
    assert.equal(image.data.byteLength, asset.size);
    assert.equal(await readOwnedImage(db, store, "another-user", asset.id), null);
    const before = objects.size;
    await assert.rejects(saveImage(db, store, id, original, "image/png"), InvalidImageError);
    await assert.rejects(saveImage(db, store, id, Buffer.from("not an image"), "image/jpeg"), InvalidImageError);
    await assert.rejects(saveImage(db, store, id, Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/jpeg"), InvalidImageError);
    assert.equal(objects.size, before);
    await assert.rejects(saveImage(db, store, "nonexistent-user", original, "image/jpeg"));
    assert.equal(objects.size, before, "object is removed when DB insertion fails");
  } finally {
    await pool.query("DELETE FROM media_assets WHERE owner_id=$1", [id]);
    await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await pool.end();
  }
});

test("upload rejects wrong origin and oversized chunked bodies before multipart parsing", async () => {
  const previous = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://example.test";
  try {
    assert.equal(validOrigin(new Request("https://example.test", { headers: { origin: "https://example.test" } })), true);
    assert.equal(validOrigin(new Request("https://example.test", { headers: { origin: "https://evil.test" } })), false);
    assert.equal(validOrigin(new Request("https://example.test")), false);
    const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: Buffer.alloc(MAX_REQUEST_BYTES + 1) });
    await assert.rejects(readBoundedMultipart(request), /TOO_LARGE/);
  } finally { if (previous === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previous; }
});

test("post image links enforce ownership, uniqueness, rollback and public approval", async () => {
  const { createMarketWithImages, createFinderWithImages, readVisibleImage, visibleImages, InvalidAttachments, imageIdsInput } = await import("../../src/lib/storage/attachments");
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const owner = `media-owner-${randomUUID()}`, other = `media-other-${randomUUID()}`;
  const objects = new Map<string, Buffer>();
  const store: ObjectStore = { async put(key, data) { objects.set(key, data); }, async get(key) { return objects.get(key)!; }, async delete(key) { objects.delete(key); } };
  try {
    await db.insert(schema.user).values([owner, other].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, status: "ACTIVE_STUDENT" as const })));
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const first = await saveImage(db, store, owner, bytes, "image/png");
    const second = await saveImage(db, store, owner, bytes, "image/png");
    assert.equal(imageIdsInput.safeParse([first.id, first.id]).success, false);
    assert.equal(imageIdsInput.safeParse(Array(5).fill(first.id)).success, false);
    const marketInput = { title: "test", description: "test", category: "기타" as const, price: 0 };
    await assert.rejects(createMarketWithImages(db, other, marketInput, [first.id]), InvalidAttachments);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM market_posts WHERE owner_id=$1', [other])).rows[0].count, 0);
    const attempts = await Promise.allSettled([createMarketWithImages(db, owner, marketInput, [first.id]), createMarketWithImages(db, owner, marketInput, [first.id])]);
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    const post = (attempts.find(r => r.status === "fulfilled") as PromiseFulfilledResult<{ id: string }>).value;
    assert.equal((await visibleImages(db, "market", [post.id])).length, 0);
    assert.ok(await readVisibleImage(db, store, first.id, owner));
    assert.equal(await readVisibleImage(db, store, first.id, other), null);
    await pool.query("UPDATE media_assets SET moderation='APPROVED' WHERE id=$1", [first.id]);
    assert.ok(await readVisibleImage(db, store, first.id));
    const finder = await createFinderWithImages(db, owner, { kind: "lost", title: "test", category: "other", color: "black", generalLocation: "school", occurredAt: "2026-01-01" }, [second.id]);
    await pool.query("UPDATE media_assets SET moderation='APPROVED' WHERE id=$1", [second.id]);
    assert.equal(await readVisibleImage(db, store, second.id), null);
    await pool.query("UPDATE finder_posts SET public_approval='APPROVED' WHERE id=$1", [finder.id]);
    assert.ok(await readVisibleImage(db, store, second.id));
    await pool.query("UPDATE finder_posts SET status='CLOSED' WHERE id=$1", [finder.id]);
    assert.equal(await readVisibleImage(db, store, second.id), null);
  } finally {
    await pool.query('DELETE FROM market_posts WHERE owner_id=$1', [owner]);
    await pool.query('DELETE FROM finder_posts WHERE owner_id=$1', [owner]);
    await pool.query('DELETE FROM media_assets WHERE owner_id=$1', [owner]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[owner, other]]);
    await pool.end();
  }
});
