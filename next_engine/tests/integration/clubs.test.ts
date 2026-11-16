/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { submitApplication } from "../../src/features/clubs/applications";

// 기능 `콜백`(): `!process.env.TEST_DATABASE_URL` 조건을 추가로 검사한다.
test("club applications require a public club, an active student, an open period and are unique under concurrency", async () => {
  // 조건 `!process.env.TEST_DATABASE_URL`: 참이면 `new Error("TEST_DATABASE_URL is required")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  const id = `club-test-${randomUUID()}`;
  let clubId: string | undefined;
  // 예외 처리: 본문 실행 중 예외가 발생하면 호출자에게 전달한다. 성공·실패 모두 마지막에 `clubId` 조건을 추가로 검사한다.
  try {
    await db.insert(schema.user).values({ id, email: `${id}@example.test`, name: id, emailVerified: true, status: "ACTIVE_STUDENT" });
    const [club] = await db.insert(schema.clubs).values({ slug: id, name: "test", category: "test", introduction: "test", isPublic: true }).returning(); clubId = club.id;
    const now = Date.now();
    const [recruitment] = await db.insert(schema.clubRecruitments).values({ clubId, title: "test", description: "test", opensAt: new Date(now - 10000), closesAt: new Date(now + 10000), isOpen: true }).returning();
    // 기능 `콜백`(): `submitApplication(db, club.id, recruitment.id, id, "hello")` 평가 결과를 반환한다.
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
    // 조건 `clubId`: 참이면 먼저 `await pool.query("DELETE FROM clubs WHERE id=$1", [clubId]);`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (clubId) await pool.query("DELETE FROM clubs WHERE id=$1", [clubId]);
    await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await pool.end();
  }
});
