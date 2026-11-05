import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../../src/lib/db/schema";
import { issueInvitation, redeemInvitation } from "../../src/features/invitations/service";
import { reserveMarketPost, transitionReservation } from "../../src/features/market/reservations";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a disposable test database");

test("invitation redemption and market reservation are atomic under concurrent requests", async () => {
  const pool = new Pool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema });
  const prefix = `test-${randomUUID()}`;
  const ids = [0, 1, 2].map((i) => `${prefix}-${i}`);
  const secret = "integration-test-secret-with-32-bytes-minimum";
  let postId: string | undefined;
  try {
    await db.insert(schema.user).values(ids.map((id, i) => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: i === 0 ? "admin" as const : "student" as const, status: i === 0 ? "ACTIVE_STUDENT" as const : "VERIFIED_PENDING_INVITE" as const })));
    const invitation = await issueInvitation(db, ids[0], secret);
    const stored = await db.select().from(schema.invitations).where(eq(schema.invitations.id, invitation.id));
    assert.notEqual(stored[0].codeHash, invitation.code);
    const attempts = await Promise.allSettled(ids.slice(1).map((id) => redeemInvitation(db, id, invitation.code, secret)));
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    const activated = await db.select().from(schema.user).where(eq(schema.user.status, "ACTIVE_STUDENT"));
    assert.equal(activated.filter((u) => ids.slice(1).includes(u.id)).length, 1);
    // A failed activation must roll the code update back for a later eligible student.
    const another = await issueInvitation(db, ids[0], secret);
    await assert.rejects(redeemInvitation(db, ids[0], another.code, secret));
    const pendingUser = activated.some((u) => u.id === ids[1]) ? ids[2] : ids[1];
    await redeemInvitation(db, pendingUser, another.code, secret);
    const [post] = await db.insert(schema.marketPosts).values({ ownerId: ids[0], title: "item", description: "description", category: "books", price: 100 }).returning();
    postId = post.id;
    const reservations = await Promise.allSettled(ids.slice(1).map((id) => reserveMarketPost(db, post.id, id)));
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id))).length, 1);
    assert.equal((await db.select().from(schema.marketPosts).where(eq(schema.marketPosts.id, post.id)))[0].status, "RESERVED");
    const [activeReservation] = await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id));
    const other = ids.slice(1).find(id => id !== activeReservation.requesterId)!;
    await assert.rejects(transitionReservation(db, post.id, other, "cancel"), { code: "FORBIDDEN" });
    await assert.rejects(transitionReservation(db, post.id, activeReservation.requesterId, "complete"), { code: "FORBIDDEN" });
    await transitionReservation(db, post.id, activeReservation.requesterId, "cancel");
    assert.equal((await db.select().from(schema.marketPosts).where(eq(schema.marketPosts.id, post.id)))[0].status, "AVAILABLE");
    await reserveMarketPost(db, post.id, other);
    await transitionReservation(db, post.id, ids[0], "complete");
    assert.equal((await db.select().from(schema.marketPosts).where(eq(schema.marketPosts.id, post.id)))[0].status, "COMPLETED");
    await assert.rejects(reserveMarketPost(db, post.id, activeReservation.requesterId), { code: "UNAVAILABLE" });
  } finally {
    if (postId) await pool.query("DELETE FROM market_posts WHERE id = $1", [postId]);
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM invitations WHERE issued_by = ANY($1::text[])", [ids]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});
