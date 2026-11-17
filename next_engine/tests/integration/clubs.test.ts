import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { submitApplication } from "../../src/features/clubs/applications";

// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("club applications require a public club, an active student, an open period and are unique under concurrency", async () => {
  // 확인할 조건: process의 env의 TEST_DATABASE_URL 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const id = `club-test-${randomUUID()}`;
  let clubId: string | undefined;
  // 아래 작업을 시도한다. 오류가 나면 이 함수를 호출한 곳에 알린다. 성공하거나 실패한 뒤에는 반드시 추가 조건을 한 번 더 확인한다.
  try {
    await db.insert(schema.user).values({ id, email: `${id}@example.test`, name: id, emailVerified: true, status: "ACTIVE_STUDENT" });
    const [club] = await db.insert(schema.clubs).values({ slug: id, name: "test", category: "test", introduction: "test", isPublic: true }).returning(); clubId = club.id;
    const now = Date.now();
    const [recruitment] = await db.insert(schema.clubRecruitments).values({ clubId, title: "test", description: "test", opensAt: new Date(now - 10000), closesAt: new Date(now + 10000), isOpen: true }).returning();
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    const attempts = await Promise.all(Array.from({ length: 5 }, () => submitApplication(db, club.id, recruitment.id, id, "hello")));
    assert.equal(attempts.filter(Boolean).length, 1);
    await pool.query("DELETE FROM club_applications WHERE recruitment_id=$1", [recruitment.id]);
    await pool.query("UPDATE clubs SET is_public=false WHERE id=$1", [club.id]);
    assert.equal(await submitApplication(db, club.id, recruitment.id, id, "hello"), false);
    await pool.query("UPDATE clubs SET is_public=true WHERE id=$1", [club.id]);
    await pool.query("UPDATE club_recruitments SET closes_at=now()-interval '1 second' WHERE id=$1", [recruitment.id]);
    assert.equal(await submitApplication(db, club.id, recruitment.id, id, "hello"), false);
    await pool.query("UPDATE club_recruitments SET closes_at=now()+interval '1 hour' WHERE id=$1", [recruitment.id]);
    await pool.query("UPDATE \"user\" SET status='SUSPENDED' WHERE id=$1", [id]);
    assert.equal(await submitApplication(db, club.id, recruitment.id, id, "hello"), false);
  } finally {
    // 확인할 조건: clubId 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (clubId) await pool.query("DELETE FROM clubs WHERE id=$1", [clubId]);
    await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await pool.end();
  }
});
