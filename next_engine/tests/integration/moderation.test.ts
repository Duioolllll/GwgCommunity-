import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { mutateFinderPost } from "../../src/features/finder/service";
import { createReport, listPendingFinder, listReports, ModerationError, parseReport, reviewFinder, updateReport } from "../../src/features/moderation/service";

const connectionString = process.env.TEST_DATABASE_URL;
// 확인할 조건: connectionString 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a migrated disposable database");

// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("moderation checks visibility, ownership, roles, concurrency and audits", async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const prefix = `moderation-${randomUUID()}`;
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  const [admin, owner, student, suspended] = ["admin", "owner", "student", "suspended"].map(x => `${prefix}-${x}`);
  // 아래 작업을 시도한다. 오류가 나면 이 함수를 호출한 곳에 알린다. 성공하거나 실패한 뒤에는 반드시 아래에 있는 작업을 실행한다.
  try {
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    // 선택 기준: 고유 번호 = 관리자. 맞으면 “관리자” 값을 사용하고, 아니면 “학생” 값을 사용한다.
    // 선택 기준: 고유 번호 = suspended. 맞으면 “정지” 값을 사용하고, 아니면 “인증된 학생” 값을 사용한다.
    await db.insert(schema.user).values([admin, owner, student, suspended].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: id === admin ? "admin" as const : "student" as const, status: id === suspended ? "SUSPENDED" as const : "ACTIVE_STUDENT" as const })));
    // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
    const [pending, visible] = await db.insert(schema.finderPosts).values(["PENDING", "APPROVED"].map(publicApproval => ({ ownerId: owner, kind: "found" as const, title: prefix, category: "문구", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03", publicApproval: publicApproval as "PENDING" | "APPROVED" }))).returning();
    const input = { targetType: "finder" as const, targetId: visible.id, reason: "검토 필요" };
    assert.equal(parseReport({ ...input, reason: " " }), null);
    assert.equal(parseReport({ ...input, targetId: "invalid" }), null);
    assert.equal(parseReport({ ...input, targetType: "user" }), null);
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    await assert.rejects(createReport(db, student, { ...input, targetId: pending.id }), (e: unknown) => e instanceof ModerationError && e.code === "NOT_FOUND");
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    await assert.rejects(createReport(db, owner, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    await assert.rejects(createReport(db, suspended, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    await assert.rejects(listReports(db, student), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    const report = await createReport(db, student, input);
    const list = await listReports(db, admin);
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    const entry = list.find(x => x.id === report.id);
    assert.ok(entry); assert.ok(!("reporterId" in entry));
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    const beforeEdit = (await listPendingFinder(db, admin)).find(x => x.id === pending.id);
    assert.ok(beforeEdit);
    await mutateFinderPost(db, pending.id, owner, { type: "edit", input: {
      kind: pending.kind, title: "검토 중 수정된 글", category: pending.category, color: pending.color,
      generalLocation: pending.generalLocation, occurredAt: pending.occurredAt,
    } });
    // 항목 목록의 항목을 하나씩 꺼내 아래 작업을 반복한다. 항목이 없으면 건너뛴다.
    for (const decision of ["APPROVED", "REJECTED"] as const) {
      // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
      await assert.rejects(reviewFinder(db, admin, pending.id, decision, beforeEdit.reviewToken), (e: unknown) => e instanceof ModerationError && e.code === "CONFLICT");
    }
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    const afterEdit = (await listPendingFinder(db, admin)).find(x => x.id === pending.id);
    assert.ok(afterEdit);
    assert.notEqual(afterEdit.reviewToken, beforeEdit.reviewToken);
    const decisions = await Promise.allSettled([reviewFinder(db, admin, pending.id, "APPROVED", afterEdit.reviewToken), reviewFinder(db, admin, pending.id, "REJECTED", afterEdit.reviewToken)]);
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(decisions.filter(x => x.status === "fulfilled").length, 1);
    const updates = await Promise.allSettled([updateReport(db, admin, report.id, "OPEN", "REVIEWED"), updateReport(db, admin, report.id, "OPEN", "RESOLVED")]);
    // 이 조건에 맞는 항목만 목록에 남긴다.
    assert.equal(updates.filter(x => x.status === "fulfilled").length, 1);
    const logs = await pool.query("SELECT action FROM audit_logs WHERE actor_id = ANY($1::text[]) AND entity_id = ANY($2::text[])", [[admin, student], [pending.id, report.id]]);
    assert.equal(logs.rowCount, 3);
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    assert.ok(logs.rows.every(row => !row.action.includes(input.reason)));
  } finally {
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM reports WHERE reporter_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM finder_posts WHERE owner_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[admin, owner, student, suspended]]);
    await pool.end();
  }
});
