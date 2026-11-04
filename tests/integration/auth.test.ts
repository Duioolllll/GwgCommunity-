import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import tls from "node:tls";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/lib/db/schema";
import { consumeInvitationAttempt } from "../../src/lib/auth/invitation-attempts";

// SMTP is deliberately bound to loopback and never relays a message.
test("HTTP signup, verification, invitation, authorization and sign-out", { timeout: 120_000 }, async (t) => {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) throw new Error("TEST_DATABASE_URL must point to a local PostgreSQL server with CREATE DATABASE permission");
  const parsed = new URL(adminUrl);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) throw new Error("HTTP authentication tests require local PostgreSQL");
  const databaseName = `gwg_auth_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: adminUrl });
  let databaseCreated = false;
  // Assigned after the cleanup hook is installed so setup failures are cleaned up too.
  /* eslint-disable prefer-const */
  let app: ReturnType<typeof spawn> | undefined;
  let smtp: net.Server | undefined;
  let pool: Pool | undefined;
  let dir: string | undefined;
  /* eslint-enable prefer-const */
  const sockets = new Set<net.Socket>();
  t.after(async () => {
    if (app?.pid && app.exitCode === null) {
      process.kill(-app.pid, "SIGTERM");
      await new Promise<void>((resolve) => app!.once("exit", () => resolve()));
    }
    await pool?.end();
    for (const socket of sockets) socket.destroy();
    if (smtp?.listening) await new Promise<void>((resolve) => smtp!.close(() => resolve()));
    if (dir) rmSync(dir, { recursive: true, force: true });
    if (databaseCreated) await adminPool.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await adminPool.end();
  });
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;
  parsed.pathname = `/${databaseName}`;
  const databaseUrl = parsed.toString();
  dir = mkdtempSync(join(tmpdir(), "gwg-smtp-test-"));
  const key = join(dir, "key.pem");
  const cert = join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
  const secureContext = tls.createSecureContext({ key: readFileSync(key), cert: readFileSync(cert) });
  const messages: string[] = [];
  smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "";
    let data = false;
    let message = "";
    let auth = false;
    function attach(connection: net.Socket | tls.TLSSocket) {
      connection.on("data", function onData(chunk: Buffer) {
        buffer += chunk.toString();
        let end: number;
        while ((end = buffer.indexOf("\r\n")) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (data) {
            if (line === ".") { messages.push(message); message = ""; data = false; connection.write("250 accepted\r\n"); }
            else message += `${line}\n`;
          } else if (auth) { auth = false; connection.write("235 authenticated\r\n"); }
          else if (/^EHLO/i.test(line)) connection.write("250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN\r\n");
          else if (/^STARTTLS/i.test(line)) {
            connection.write("220 ready for TLS\r\n");
            connection.removeListener("data", onData);
            const encrypted = new tls.TLSSocket(connection, { isServer: true, secureContext });
            encrypted.on("error", () => {}); attach(encrypted); return;
          } else if (/^AUTH PLAIN /i.test(line)) connection.write("235 authenticated\r\n");
          else if (/^AUTH/i.test(line)) { auth = true; connection.write("334 \r\n"); }
          else if (/^DATA/i.test(line)) { data = true; connection.write("354 send data\r\n"); }
          else if (/^QUIT/i.test(line)) { connection.end("221 bye\r\n"); return; }
          else connection.write("250 ok\r\n");
        }
      });
    }
    attach(socket);
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const port = (smtp.address() as net.AddressInfo).port;
  const reservation = net.createServer();
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const appPort = (reservation.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const baseURL = `http://127.0.0.1:${appPort}`;
  const invitationSecret = "auth-test-invitation-secret-at-least-32-bytes";
  execFileSync("pnpm", ["db:migrate"], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  app = spawn("pnpm", ["exec", "next", "dev", "-H", "127.0.0.1", "-p", String(appPort)], {
    env: { ...process.env, DATABASE_URL: databaseUrl, BETTER_AUTH_URL: baseURL, BETTER_AUTH_SECRET: "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz", INVITATION_SECRET: invitationSecret,
      SMTP_HOST: "localhost", SMTP_PORT: String(port), SMTP_USER: "test", SMTP_PASSWORD: "test", SMTP_FROM: "test@example.test", NODE_EXTRA_CA_CERTS: cert, NODE_OPTIONS: "--dns-result-order=ipv4first" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let appOutput = "";
  app.stdout?.on("data", (data) => { appOutput += data.toString(); });
  app.stderr?.on("data", (data) => { appOutput += data.toString(); });
  pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const email = `auth-test-${randomUUID()}@example.test`;
  let userId: string | undefined;
  {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (app.exitCode !== null) throw new Error(`Next.js exited: ${appOutput}`);
      try { await fetch(`${baseURL}/api/me`, { signal: AbortSignal.timeout(2_000) }); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 300)); }
    }
    assert.ok(ready, `Next.js did not start: ${appOutput}`);
    const call = (path: string, body?: object, cookie?: string, origin = baseURL) => fetch(`${baseURL}${path}`, {
      method: body ? "POST" : "GET",
      headers: { origin, ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
      redirect: "manual",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const password = "integration-test-password-123";
    let response = await call("/api/auth/sign-up/email", { name: "Test Student", email, password, callbackURL: "/auth/login", role: "admin", status: "ACTIVE_STUDENT" });
    assert.equal(response.status, 200, await response.clone().text());
    const row = await pool.query('SELECT id, email_verified, role, status FROM "user" WHERE email=$1', [email]);
    userId = row.rows[0].id;
    assert.deepEqual([row.rows[0].email_verified, row.rows[0].role, row.rows[0].status], [false, "student", "UNVERIFIED_EMAIL"]);
    response = await call("/api/auth/sign-in/email", { email, password });
    assert.equal(response.status, 403);
    assert.ok(messages.length >= 1, "verification email was delivered to loopback SMTP");
    const decoded = messages[0].replace(/=\n/g, "").replace(/=([A-F0-9]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    const verificationUrl = decoded.match(/http:\/\/127\.0\.0\.1:\d+\/api\/auth\/verify-email\?[^\s]+/)?.[0];
    assert.ok(verificationUrl, "verification link is present in the SMTP message");
    response = await fetch(verificationUrl, { redirect: "manual" });
    assert.ok([200, 302].includes(response.status), await response.clone().text());
    const verified = await pool.query('SELECT email_verified, status FROM "user" WHERE id=$1', [userId]);
    assert.deepEqual([verified.rows[0].email_verified, verified.rows[0].status], [true, "VERIFIED_PENDING_INVITE"]);
    await pool.query('UPDATE "user" SET status=$1 WHERE id=$2', ["SUSPENDED", userId]);
    response = await call("/api/auth/sign-in/email", { email, password });
    assert.equal(response.status, 403);
    await pool.query('UPDATE "user" SET status=$1 WHERE id=$2', ["VERIFIED_PENDING_INVITE", userId]);
    response = await call("/api/auth/sign-in/email", { email, password });
    assert.equal(response.status, 200, await response.clone().text());
    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie);
    const cookie = setCookie.split(";")[0];
    let current = await (await call("/api/me", undefined, cookie)).json();
    assert.equal(current.user?.status, "VERIFIED_PENDING_INVITE");
    assert.equal((await call("/api/invitations/redeem", { code: "a".repeat(32) })).status, 401);
    assert.equal((await call("/api/admin/invitations", {}, cookie)).status, 403);
    assert.equal((await call("/api/invitations/redeem", { code: "a".repeat(32) }, cookie, "https://evil.example")).status, 403);
    await pool.query('UPDATE "user" SET role=$1, status=$2 WHERE id=$3', ["admin", "ACTIVE_STUDENT", userId]);
    const targetId = `auth-target-${randomUUID()}`;
    await pool.query('INSERT INTO "user" (id, name, email, email_verified, role, status) VALUES ($1, $1, $2, true, $3, $4)', [targetId, `${targetId}@example.test`, "student", "VERIFIED_PENDING_INVITE"]);
    await pool.query('INSERT INTO "session" (id, token, user_id, expires_at) VALUES ($1, $2, $3, now() + interval \'1 day\')', [randomUUID(), randomUUID(), targetId]);
    assert.equal((await call(`/api/admin/users/${userId}/status`, { action: "suspend" }, cookie)).status, 403);
    assert.equal((await call(`/api/admin/users/${targetId}/status`, { action: "suspend" }, cookie, "https://evil.example")).status, 403);
    response = await call(`/api/admin/users/${targetId}/status`, { action: "suspend" }, cookie);
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM "session" WHERE user_id=$1', [targetId])).rows[0].n, 0);
    assert.equal((await call(`/api/admin/users/${targetId}/status`, { action: "suspend" }, cookie)).status, 409);
    response = await call(`/api/admin/users/${targetId}/status`, { action: "unsuspend" }, cookie);
    assert.equal((await response.json()).status, "VERIFIED_PENDING_INVITE");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action IN ('user.suspended', 'user.unsuspended')", [targetId])).rows[0].n, 2);
    response = await call("/api/admin/invitations", {}, cookie);
    assert.equal(response.status, 201, await response.clone().text());
    const invitation = await response.json() as { code: string };
    await pool.query('UPDATE "user" SET role=$1, status=$2 WHERE id=$3', ["student", "VERIFIED_PENDING_INVITE", userId]);
    const concurrentAttempts = await Promise.all(Array.from({ length: 12 }, () => consumeInvitationAttempt(db, userId!)));
    assert.equal(concurrentAttempts.filter(Boolean).length, 5, "concurrent attempts cannot exceed the shared limit");
    assert.equal(await consumeInvitationAttempt(db, userId!), false);
    await pool.query("UPDATE invitation_attempts SET window_start=now() - interval '16 minutes' WHERE user_id=$1", [userId]);
    assert.equal(await consumeInvitationAttempt(db, userId!), true);
    response = await call("/api/invitations/redeem", { code: invitation.code }, cookie);
    assert.equal(response.status, 200, await response.clone().text());
    current = await (await call("/api/me", undefined, cookie)).json();
    assert.equal(current.user?.status, "ACTIVE_STUDENT");
    assert.equal((await call("/api/admin/invitations", {}, cookie)).status, 403);
    assert.equal((await call("/api/invitations/redeem", { code: invitation.code }, cookie)).status, 403);
    const finderInput = { kind: "lost", title: "HTTP 검증 지갑", category: "잡화", color: "검정", generalLocation: "본관", occurredAt: "2026-11-03" };
    response = await call("/api/finder", finderInput, cookie);
    assert.equal(response.status, 201, await response.clone().text());
    const finderId = (await response.json()).post.id;
    const mutateFinder = (method: string, body?: object, sessionCookie = cookie, origin = baseURL, id = finderId) => fetch(`${baseURL}/api/finder/${id}`, {
      method, headers: { origin, "content-type": "application/json", cookie: sessionCookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await mutateFinder("PATCH", finderInput, "")).status, 401);
    assert.equal((await mutateFinder("PATCH", finderInput, cookie, "https://evil.example")).status, 403);
    assert.equal((await mutateFinder("PATCH", { ...finderInput, ownerId: targetId })).status, 400);
    const [otherPost] = await db.insert(schema.finderPosts).values({ ...finderInput, kind: "found", ownerId: targetId }).returning();
    assert.equal((await mutateFinder("DELETE", undefined, cookie, baseURL, otherPost.id)).status, 403);
    response = await mutateFinder("PATCH", { ...finderInput, title: "수정된 지갑" });
    assert.equal(response.status, 200, await response.clone().text());
    const ownPage = await call(`/finder/${finderId}`, undefined, cookie);
    assert.equal(ownPage.status, 200);
    assert.ok((await ownPage.text()).includes("수정된 지갑"));
    assert.equal((await mutateFinder("PATCH", { action: "close" })).status, 200);
    assert.equal((await mutateFinder("PATCH", finderInput)).status, 409);
    assert.equal((await mutateFinder("DELETE")).status, 200);
    assert.equal((await mutateFinder("DELETE")).status, 404);
    response = await call("/api/auth/sign-out", {}, cookie);
    assert.equal(response.status, 200);
    assert.equal((await call("/api/me", undefined, cookie)).status, 401);
  }
});
