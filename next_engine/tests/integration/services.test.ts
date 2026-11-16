/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
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
// 조건 `!connectionString`: 참이면 `new Error("TEST_DATABASE_URL must point to a disposable test database")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a disposable test database");

// 기능 `콜백`(): 먼저 `const pool = new Pool({ connectionString, max: 5 });`를 실행한다.
test("invitation redemption and market reservation are atomic under concurrent requests", async () => {
  const pool = new Pool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema });
  const prefix = `test-${randomUUID()}`;
  // 기능 `콜백`(i): ``${prefix}-${i}`` 평가 결과를 반환한다.
  const ids = [0, 1, 2].map((i) => `${prefix}-${i}`);
  const secret = "integration-test-secret-with-32-bytes-minimum";
  let postId: string | undefined;
  // 예외 처리: 본문 실행 중 예외가 발생하면 호출자에게 전달한다. 성공·실패 모두 마지막에 `postId` 조건을 추가로 검사한다.
  try {
    // 기능 `콜백`(id, i): `({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: i === 0 ? "admin" as const : "student" as const, status: i === 0 ? "ACTIVE_STUDENT" as const : "VERIFIED_PENDING_INVITE" as const })` 평가 결과를 반환한다.
    // 선택 조건 `i === 0`: 참이면 `"admin" as const`, 거짓이면 `"student" as const`를 사용한다.
    // 선택 조건 `i === 0`: 참이면 `"ACTIVE_STUDENT" as const`, 거짓이면 `"VERIFIED_PENDING_INVITE" as const`를 사용한다.
    await db.insert(schema.user).values(ids.map((id, i) => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: i === 0 ? "admin" as const : "student" as const, status: i === 0 ? "ACTIVE_STUDENT" as const : "VERIFIED_PENDING_INVITE" as const })));
    const invitation = await issueInvitation(db, ids[0], secret);
    const stored = await db.select().from(schema.invitations).where(eq(schema.invitations.id, invitation.id));
    assert.notEqual(stored[0].codeHash, invitation.code);
    // 기능 `콜백`(id): `redeemInvitation(db, id, invitation.code, secret)` 평가 결과를 반환한다.
    const attempts = await Promise.allSettled(ids.slice(1).map((id) => redeemInvitation(db, id, invitation.code, secret)));
    // 기능 `콜백`(r): `r.status === "fulfilled"` 평가 결과를 반환한다.
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    const activated = await db.select().from(schema.user).where(eq(schema.user.status, "ACTIVE_STUDENT"));
    // 기능 `콜백`(u): `ids.slice(1).includes(u.id)` 평가 결과를 반환한다.
    assert.equal(activated.filter((u) => ids.slice(1).includes(u.id)).length, 1);
    // A failed activation must roll the code update back for a later eligible student.
    const another = await issueInvitation(db, ids[0], secret);
    await assert.rejects(redeemInvitation(db, ids[0], another.code, secret));
    // 선택 조건 `activated.some((u) => u.id === ids[1])`: 참이면 `ids[2]`, 거짓이면 `ids[1]`를 사용한다.
    // 기능 `콜백`(u): `u.id === ids[1]` 평가 결과를 반환한다.
    const pendingUser = activated.some((u) => u.id === ids[1]) ? ids[2] : ids[1];
    await redeemInvitation(db, pendingUser, another.code, secret);
    const [post] = await db.insert(schema.marketPosts).values({ ownerId: ids[0], title: "item", description: "description", category: "books", price: 100 }).returning();
    postId = post.id;
    // 기능 `콜백`(id): `reserveMarketPost(db, post.id, id)` 평가 결과를 반환한다.
    const reservations = await Promise.allSettled(ids.slice(1).map((id) => reserveMarketPost(db, post.id, id)));
    // 기능 `콜백`(r): `r.status === "fulfilled"` 평가 결과를 반환한다.
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id))).length, 1);
    assert.equal((await db.select().from(schema.marketPosts).where(eq(schema.marketPosts.id, post.id)))[0].status, "RESERVED");
    const [activeReservation] = await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id));
    // 기능 `콜백`(id): `id !== activeReservation.requesterId` 평가 결과를 반환한다.
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
    // 조건 `postId`: 참이면 먼저 `await pool.query("DELETE FROM market_posts WHERE id = $1", [postId]);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (postId) await pool.query("DELETE FROM market_posts WHERE id = $1", [postId]);
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM invitations WHERE issued_by = ANY($1::text[])", [ids]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});
