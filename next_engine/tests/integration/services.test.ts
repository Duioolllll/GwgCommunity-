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
// 확인할 조건: connectionString 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a disposable test database");

// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("invitation redemption and market reservation are atomic under concurrent requests", async () => {
  const pool = new Pool({ connectionString, max: 5 });
  const db = drizzle(pool, { schema });
  const prefix = `test-${randomUUID()}`;
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  const ids = [0, 1, 2].map((i) => `${prefix}-${i}`);
  const secret = "integration-test-secret-with-32-bytes-minimum";
  let postId: string | undefined;
  // 아래 작업을 시도한다. 오류가 나면 이 함수를 호출한 곳에 알린다. 성공하거나 실패한 뒤에는 반드시 추가 조건을 한 번 더 확인한다.
  try {
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    // 선택 기준: i = 0. 맞으면 “관리자” 값을 사용하고, 아니면 “학생” 값을 사용한다.
    // 선택 기준: i = 0. 맞으면 “인증된 학생” 값을 사용하고, 아니면 “VERIFIED_PENDING_INVITE” 값을 사용한다.
    await db.insert(schema.user).values(ids.map((id, i) => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: i === 0 ? "admin" as const : "student" as const, status: i === 0 ? "ACTIVE_STUDENT" as const : "VERIFIED_PENDING_INVITE" as const })));
    const invitation = await issueInvitation(db, ids[0], secret);
    const stored = await db.select().from(schema.invitations).where(eq(schema.invitations.id, invitation.id));
    assert.notEqual(stored[0].codeHash, invitation.code);
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    const attempts = await Promise.allSettled(ids.slice(1).map((id) => redeemInvitation(db, id, invitation.code, secret)));
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
    const activated = await db.select().from(schema.user).where(eq(schema.user.status, "ACTIVE_STUDENT"));
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(activated.filter((u) => ids.slice(1).includes(u.id)).length, 1);
    // 학생 인증이 실패하면 초대 코드를 사용한 것으로 남기지 않는다. 나중에 조건에 맞는 학생이 쓸 수 있어야 한다.
    const another = await issueInvitation(db, ids[0], secret);
    await assert.rejects(redeemInvitation(db, ids[0], another.code, secret));
    // 선택 기준: some 처리 결과 있음 또는 true. 맞으면 이미지 번호 목록에서 2에 해당하는 값을 사용하고, 아니면 이미지 번호 목록에서 1에 해당하는 값을 사용한다.
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    const pendingUser = activated.some((u) => u.id === ids[1]) ? ids[2] : ids[1];
    await redeemInvitation(db, pendingUser, another.code, secret);
    const [post] = await db.insert(schema.marketPosts).values({ ownerId: ids[0], title: "item", description: "description", category: "books", price: 100 }).returning();
    postId = post.id;
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    const reservations = await Promise.allSettled(ids.slice(1).map((id) => reserveMarketPost(db, post.id, id)));
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id))).length, 1);
    assert.equal((await db.select().from(schema.marketPosts).where(eq(schema.marketPosts.id, post.id)))[0].status, "RESERVED");
    const [activeReservation] = await db.select().from(schema.marketReservations).where(eq(schema.marketReservations.postId, post.id));
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
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
    // 확인할 조건: 게시글 번호 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (postId) await pool.query("DELETE FROM market_posts WHERE id = $1", [postId]);
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [ids]);
    await pool.query("DELETE FROM invitations WHERE issued_by = ANY($1::text[])", [ids]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
    await pool.end();
  }
});
