/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { mutateFinderPost } from "../../src/features/finder/service";
import { createReport, listPendingFinder, listReports, ModerationError, parseReport, reviewFinder, updateReport } from "../../src/features/moderation/service";

const connectionString = process.env.TEST_DATABASE_URL;
// 조건 `!connectionString`: 참이면 `new Error("TEST_DATABASE_URL must point to a migrated disposable database")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a migrated disposable database");

// 기능 `콜백`(): 먼저 `const pool = new Pool({ connectionString });`를 실행한다.
test("moderation checks visibility, ownership, roles, concurrency and audits", async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const prefix = `moderation-${randomUUID()}`;
  // 기능 `콜백`(x): ``${prefix}-${x}`` 평가 결과를 반환한다.
  const [admin, owner, student, suspended] = ["admin", "owner", "student", "suspended"].map(x => `${prefix}-${x}`);
  // 예외 처리: 본문 실행 중 예외가 발생하면 호출자에게 전달한다. 성공·실패 모두 마지막에 먼저 `await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [[admin, owner, student, suspended]]);`를 실행한다.
  try {
    // 기능 `콜백`(id): `({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: id === admin ? "admin" as const : "student" as const, status: id === suspended ? "SUSPENDED" as const : "ACTIVE_STUDENT" as const })` 평가 결과를 반환한다.
    // 선택 조건 `id === admin`: 참이면 `"admin" as const`, 거짓이면 `"student" as const`를 사용한다.
    // 선택 조건 `id === suspended`: 참이면 `"SUSPENDED" as const`, 거짓이면 `"ACTIVE_STUDENT" as const`를 사용한다.
    await db.insert(schema.user).values([admin, owner, student, suspended].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: id === admin ? "admin" as const : "student" as const, status: id === suspended ? "SUSPENDED" as const : "ACTIVE_STUDENT" as const })));
    // 기능 `콜백`(publicApproval): `({ ownerId: owner, kind: "found" as const, title: prefix, category: "문구", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03", publicApproval: publicApproval as "PENDING" | "APPROVED" })` 평가 결과를 반환한다.
    const [pending, visible] = await db.insert(schema.finderPosts).values(["PENDING", "APPROVED"].map(publicApproval => ({ ownerId: owner, kind: "found" as const, title: prefix, category: "문구", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03", publicApproval: publicApproval as "PENDING" | "APPROVED" }))).returning();
    const input = { targetType: "finder" as const, targetId: visible.id, reason: "검토 필요" };
    assert.equal(parseReport({ ...input, reason: " " }), null);
    assert.equal(parseReport({ ...input, targetId: "invalid" }), null);
    assert.equal(parseReport({ ...input, targetType: "user" }), null);
    // 기능 `콜백`(e): `e instanceof ModerationError && e.code === "NOT_FOUND"` 평가 결과를 반환한다.
    // 단락 분기 `e instanceof ModerationError`: 참인 경우에만 오른쪽 `e.code === "NOT_FOUND"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    await assert.rejects(createReport(db, student, { ...input, targetId: pending.id }), (e: unknown) => e instanceof ModerationError && e.code === "NOT_FOUND");
    // 기능 `콜백`(e): `e instanceof ModerationError && e.code === "FORBIDDEN"` 평가 결과를 반환한다.
    // 단락 분기 `e instanceof ModerationError`: 참인 경우에만 오른쪽 `e.code === "FORBIDDEN"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    await assert.rejects(createReport(db, owner, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    // 기능 `콜백`(e): `e instanceof ModerationError && e.code === "FORBIDDEN"` 평가 결과를 반환한다.
    // 단락 분기 `e instanceof ModerationError`: 참인 경우에만 오른쪽 `e.code === "FORBIDDEN"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    await assert.rejects(createReport(db, suspended, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    // 기능 `콜백`(e): `e instanceof ModerationError && e.code === "FORBIDDEN"` 평가 결과를 반환한다.
    // 단락 분기 `e instanceof ModerationError`: 참인 경우에만 오른쪽 `e.code === "FORBIDDEN"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    await assert.rejects(listReports(db, student), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    const report = await createReport(db, student, input);
    const list = await listReports(db, admin);
    // 기능 `콜백`(x): `x.id === report.id` 평가 결과를 반환한다.
    const entry = list.find(x => x.id === report.id);
    assert.ok(entry); assert.ok(!("reporterId" in entry));
    // 기능 `콜백`(x): `x.id === pending.id` 평가 결과를 반환한다.
    const beforeEdit = (await listPendingFinder(db, admin)).find(x => x.id === pending.id);
    assert.ok(beforeEdit);
    await mutateFinderPost(db, pending.id, owner, { type: "edit", input: {
      kind: pending.kind, title: "검토 중 수정된 글", category: pending.category, color: pending.color,
      generalLocation: pending.generalLocation, occurredAt: pending.occurredAt,
    } });
    // 반복 `["APPROVED", "REJECTED"] as const`: 각 값를 `const decision`에 바인딩한다. 대상이 비었으면 본문을 건너뛴다.
    for (const decision of ["APPROVED", "REJECTED"] as const) {
      // 기능 `콜백`(e): `e instanceof ModerationError && e.code === "CONFLICT"` 평가 결과를 반환한다.
      // 단락 분기 `e instanceof ModerationError`: 참인 경우에만 오른쪽 `e.code === "CONFLICT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      await assert.rejects(reviewFinder(db, admin, pending.id, decision, beforeEdit.reviewToken), (e: unknown) => e instanceof ModerationError && e.code === "CONFLICT");
    }
    // 기능 `콜백`(x): `x.id === pending.id` 평가 결과를 반환한다.
    const afterEdit = (await listPendingFinder(db, admin)).find(x => x.id === pending.id);
    assert.ok(afterEdit);
    assert.notEqual(afterEdit.reviewToken, beforeEdit.reviewToken);
    const decisions = await Promise.allSettled([reviewFinder(db, admin, pending.id, "APPROVED", afterEdit.reviewToken), reviewFinder(db, admin, pending.id, "REJECTED", afterEdit.reviewToken)]);
    // 기능 `콜백`(x): `x.status === "fulfilled"` 평가 결과를 반환한다.
    assert.equal(decisions.filter(x => x.status === "fulfilled").length, 1);
    const updates = await Promise.allSettled([updateReport(db, admin, report.id, "OPEN", "REVIEWED"), updateReport(db, admin, report.id, "OPEN", "RESOLVED")]);
    // 기능 `콜백`(x): `x.status === "fulfilled"` 평가 결과를 반환한다.
    assert.equal(updates.filter(x => x.status === "fulfilled").length, 1);
    const logs = await pool.query("SELECT action FROM audit_logs WHERE actor_id = ANY($1::text[]) AND entity_id = ANY($2::text[])", [[admin, student], [pending.id, report.id]]);
    assert.equal(logs.rowCount, 3);
    // 기능 `콜백`(row): `!row.action.includes(input.reason)` 평가 결과를 반환한다.
    assert.ok(logs.rows.every(row => !row.action.includes(input.reason)));
  } finally {
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM reports WHERE reporter_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM finder_posts WHERE owner_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[admin, owner, student, suspended]]);
    await pool.end();
  }
});
