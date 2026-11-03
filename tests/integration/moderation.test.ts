import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { createReport, listPendingFinder, listReports, ModerationError, parseReport, reviewFinder, updateReport } from "../../src/features/moderation/service";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL must point to a migrated disposable database");

test("moderation checks visibility, ownership, roles, concurrency and audits", async () => {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const prefix = `moderation-${randomUUID()}`;
  const [admin, owner, student, suspended] = ["admin", "owner", "student", "suspended"].map(x => `${prefix}-${x}`);
  try {
    await db.insert(schema.user).values([admin, owner, student, suspended].map(id => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, role: id === admin ? "admin" as const : "student" as const, status: id === suspended ? "SUSPENDED" as const : "ACTIVE_STUDENT" as const })));
    const [pending, visible] = await db.insert(schema.finderPosts).values(["PENDING", "APPROVED"].map(publicApproval => ({ ownerId: owner, kind: "found" as const, title: prefix, category: "문구", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03", publicApproval: publicApproval as "PENDING" | "APPROVED" }))).returning();
    const input = { targetType: "finder" as const, targetId: visible.id, reason: "검토 필요" };
    assert.equal(parseReport({ ...input, reason: " " }), null);
    assert.equal(parseReport({ ...input, targetId: "invalid" }), null);
    assert.equal(parseReport({ ...input, targetType: "user" }), null);
    await assert.rejects(createReport(db, student, { ...input, targetId: pending.id }), (e: unknown) => e instanceof ModerationError && e.code === "NOT_FOUND");
    await assert.rejects(createReport(db, owner, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    await assert.rejects(createReport(db, suspended, input), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    await assert.rejects(listReports(db, student), (e: unknown) => e instanceof ModerationError && e.code === "FORBIDDEN");
    const report = await createReport(db, student, input);
    const list = await listReports(db, admin);
    const entry = list.find(x => x.id === report.id);
    assert.ok(entry); assert.ok(!("reporterId" in entry));
    assert.ok((await listPendingFinder(db, admin)).some(x => x.id === pending.id));
    const decisions = await Promise.allSettled([reviewFinder(db, admin, pending.id, "APPROVED"), reviewFinder(db, admin, pending.id, "REJECTED")]);
    assert.equal(decisions.filter(x => x.status === "fulfilled").length, 1);
    const updates = await Promise.allSettled([updateReport(db, admin, report.id, "OPEN", "REVIEWED"), updateReport(db, admin, report.id, "OPEN", "RESOLVED")]);
    assert.equal(updates.filter(x => x.status === "fulfilled").length, 1);
    const logs = await pool.query("SELECT action FROM audit_logs WHERE actor_id = ANY($1::text[]) AND entity_id = ANY($2::text[])", [[admin, student], [pending.id, report.id]]);
    assert.equal(logs.rowCount, 3);
    assert.ok(logs.rows.every(row => !row.action.includes(input.reason)));
  } finally {
    await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM reports WHERE reporter_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query("DELETE FROM finder_posts WHERE owner_id = ANY($1::text[])", [[admin, owner, student, suspended]]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[admin, owner, student, suspended]]);
    await pool.end();
  }
});
