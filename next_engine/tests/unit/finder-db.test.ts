import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { listFinderPosts } from "../../src/features/finder/posts";
import { FinderMatchError, FinderMutationError, getFinderMatches, mutateFinderPost } from "../../src/features/finder/service";

const connectionString = process.env.TEST_DATABASE_URL;
test("Finder mutations enforce account and ownership, re-review edits, and preserve attachments", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const prefix = `finder-mutation-${randomUUID()}`;
  const owner = `${prefix}-owner`, other = `${prefix}-other`, suspended = `${prefix}-suspended`;
  try {
    await db.insert(schema.user).values([owner, other, suspended].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, status: id === suspended ? "SUSPENDED" as const : "ACTIVE_STUDENT" as const })));
    const input = { kind: "lost" as const, title: "지갑", category: "잡화", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03" };
    const [post] = await db.insert(schema.finderPosts).values({ ...input, ownerId: owner, publicApproval: "APPROVED" }).returning();
    const [asset] = await db.insert(schema.mediaAssets).values({ ownerId: owner, storageKey: prefix, contentType: "image/png", size: 10 }).returning();
    await db.insert(schema.postMedia).values({ mediaId: asset.id, finderPostId: post.id });
    await assert.rejects(mutateFinderPost(db, post.id, other, { type: "delete" }), (e: unknown) => e instanceof FinderMutationError && e.code === "FORBIDDEN");
    await assert.rejects(mutateFinderPost(db, post.id, suspended, { type: "close" }), (e: unknown) => e instanceof FinderMutationError && e.code === "FORBIDDEN");
    await mutateFinderPost(db, post.id, owner, { type: "edit", input: { ...input, title: "수정한 지갑" } });
    const [edited] = await db.select().from(schema.finderPosts).where(eq(schema.finderPosts.id, post.id));
    assert.equal(edited.title, "수정한 지갑");
    assert.equal(edited.publicApproval, "PENDING");
    assert.equal((await db.select().from(schema.postMedia).where(eq(schema.postMedia.mediaId, asset.id))).length, 1);
    assert.ok(!(await listFinderPosts(db)).some(item => item.id === post.id));
    await mutateFinderPost(db, post.id, owner, { type: "close" });
    assert.ok(!(await listFinderPosts(db, owner)).some(item => item.id === post.id));
    await assert.rejects(mutateFinderPost(db, post.id, owner, { type: "edit", input }), (e: unknown) => e instanceof FinderMutationError && e.code === "CONFLICT");
    await mutateFinderPost(db, post.id, owner, { type: "delete" });
    assert.equal((await db.select().from(schema.postMedia).where(eq(schema.postMedia.mediaId, asset.id))).length, 0);
    assert.equal((await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, asset.id))).length, 1);
  } finally {
    await pool.query("DELETE FROM finder_posts WHERE owner_id = ANY($1::text[])", [[owner, other, suspended]]);
    await pool.query("DELETE FROM media_assets WHERE owner_id = ANY($1::text[])", [[owner, other, suspended]]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[owner, other, suspended]]);
    await pool.end();
  }
});
test("database visibility and match authorization", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const prefix = `finder-test-${randomUUID()}`;
  const owner = `${prefix}-owner`, other = `${prefix}-other`, unverified = `${prefix}-unverified`;
  try {
    await db.insert(schema.user).values([owner, other, unverified].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: id !== unverified, status: "ACTIVE_STUDENT" as const })));
    const base = { ownerId: owner, title: prefix, category: "책", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03" };
    const [lost, found, approved, ownPending] = await db.insert(schema.finderPosts).values([
      { ...base, kind: "lost" }, { ...base, ownerId: other, kind: "found" }, { ...base, ownerId: other, kind: "found", publicApproval: "APPROVED" }, { ...base, kind: "found" },
    ]).returning();
    const publicList = await listFinderPosts(db);
    assert.ok(publicList.some(p => p.id === approved.id));
    assert.ok(!publicList.some(p => p.id === lost.id || p.id === found.id));
    const ownList = await listFinderPosts(db, owner);
    assert.ok(ownList.some(p => p.id === lost.id));
    assert.ok(!ownList.some(p => p.id === found.id));
    const matches = await getFinderMatches(db, lost.id, owner);
    assert.ok(!matches.some(m => m.post.id === found.id));
    assert.ok(matches.some(m => m.post.id === approved.id && m.score.total === 100));
    assert.ok(matches.some(m => m.post.id === ownPending.id));
    assert.ok(matches.every(m => !("ownerId" in m.post) && !("publicApproval" in m.post)));
    await assert.rejects(getFinderMatches(db, lost.id, other), (e: unknown) => e instanceof FinderMatchError && e.code === "FORBIDDEN");
    await assert.rejects(getFinderMatches(db, lost.id, unverified), (e: unknown) => e instanceof FinderMatchError && e.code === "FORBIDDEN");
  } finally {
    await pool.query("DELETE FROM finder_posts WHERE owner_id = ANY($1::text[])", [[owner, other, unverified]]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[owner, other, unverified]]);
    await pool.end();
  }
});

test("Finder filters and pagination preserve literal search terms", { skip: !connectionString }, async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const owner = `finder-filter-${randomUUID()}`;
  try {
    await db.insert(schema.user).values({ id: owner, name: owner, email: `${owner}@example.test`, emailVerified: true, status: "ACTIVE_STUDENT" });
    await db.insert(schema.finderPosts).values(Array.from({ length: 22 }, (_, i) => ({
      ownerId: owner, kind: "lost" as const, title: `${owner} % ${i}`, category: "문구", color: "검정",
      generalLocation: "본관", occurredAt: "2026-11-03", publicApproval: "APPROVED" as const,
    })));
    const filter = { q: owner, category: "문구", color: "검정" };
    const first = await listFinderPosts(db, undefined, 1, "lost", filter);
    const second = await listFinderPosts(db, undefined, 2, "lost", filter);
    assert.equal(first.length, 21);
    assert.equal(second.length, 2);
    assert.ok(second.every(post => !first.slice(0, 20).some(p => p.id === post.id)));
    assert.equal((await listFinderPosts(db, undefined, 1, "found", filter)).length, 0);
    assert.equal((await listFinderPosts(db, undefined, 1, "lost", { ...filter, color: "흰색" })).length, 0);
    assert.equal((await listFinderPosts(db, undefined, 1, "lost", { ...filter, q: `${owner} _` })).length, 0);
    assert.equal((await listFinderPosts(db, undefined, 1, "lost", { ...filter, q: `${owner} %` })).length, 21);
  } finally {
    await pool.query("DELETE FROM finder_posts WHERE owner_id = $1", [owner]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [owner]);
    await pool.end();
  }
});
