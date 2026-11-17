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

// 테스트용 메일 서버는 이 컴퓨터 안에서만 접속할 수 있고 실제 외부 메일은 보내지 않는다.
// 이름에 적힌 상황에서 결과가 예상대로 나오는지 확인하는 테스트다.
test("HTTP signup, verification, invitation, authorization and sign-out", { timeout: 120_000 }, async (t) => {
  const adminUrl = process.env.TEST_DATABASE_URL;
  // 확인할 조건: adminUrl 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!adminUrl) throw new Error("TEST_DATABASE_URL must point to a local PostgreSQL server with CREATE DATABASE permission");
  const parsed = new URL(adminUrl);
  // 확인할 조건: 항목 목록에 parsed의 hostname이 포함됨 조건을 만족하지 않음. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) throw new Error("HTTP authentication tests require local PostgreSQL");
  const databaseName = `gwg_auth_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: adminUrl });
  let databaseCreated = false;
  // 테스트 준비 중에 실패해도 정리할 수 있도록 정리 방법을 먼저 등록한다.
  /* eslint-disable prefer-const */
  let app: ReturnType<typeof spawn> | undefined;
  let smtp: net.Server | undefined;
  let pool: Pool | undefined;
  let dir: string | undefined;
  /* eslint-enable prefer-const */
  const sockets = new Set<net.Socket>();
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  t.after(async () => {
    // 확인할 조건: (app의 pid 있음 또는 true) 그리고 (app의 exitCode = 값 없음). 해당하면 아래에 있는 작업을 실행한다.
    if (app?.pid && app.exitCode === null) {
      process.kill(-app.pid, "SIGTERM");
      // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
      await new Promise<void>((resolve) => app!.once("exit", () => resolve()));
    }
    await pool?.end();
    // sockets의 항목을 하나씩 꺼내 아래 작업을 반복한다. 항목이 없으면 건너뛴다.
    for (const socket of sockets) socket.destroy();
    // 확인할 조건: smtp의 listening 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    if (smtp?.listening) await new Promise<void>((resolve) => smtp!.close(() => resolve()));
    // 확인할 조건: dir 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
    if (dir) rmSync(dir, { recursive: true, force: true });
    // 확인할 조건: databaseCreated 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
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
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  smtp = net.createServer((socket) => {
    sockets.add(socket);
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    socket.on("close", () => sockets.delete(socket));
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "";
    let data = false;
    let message = "";
    let auth = false;
    // 현재 사용자의 이미지만 글에 연결하고 다른 글에 이미 쓰인 이미지는 막는다.
    function attach(connection: net.Socket | tls.TLSSocket) {
      // 테스트용 메일 서버로 들어온 내용을 읽고 SMTP 단계에 맞춰 응답한다.
      connection.on("data", function onData(chunk: Buffer) {
        buffer += chunk.toString();
        let end: number;
        while ((end = buffer.indexOf("\r\n")) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          // 확인할 조건: 저장하거나 받은 자료 있음 또는 true. 해당하면 추가 조건을 한 번 더 확인한다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
          // 확인할 조건: auth 있음 또는 true. 해당하면 auth을 사용하지 않음으로 바꾼다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
          // 확인할 조건: line의 형식이 맞음 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
          // 확인할 조건: line의 형식이 맞음 있음 또는 true. 해당하면 auth을 사용함으로 바꾼다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
          // 확인할 조건: line의 형식이 맞음 있음 또는 true. 해당하면 저장하거나 받은 자료를 사용함으로 바꾼다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
          // 확인할 조건: line의 형식이 맞음 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 아래에 있는 작업을 실행한다.
          if (data) {
            // 확인할 조건: line = “.”. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 아래에 있는 작업을 실행한다.
            if (line === ".") { messages.push(message); message = ""; data = false; connection.write("250 accepted\r\n"); }
            else message += `${line}\n`;
          } else if (auth) { auth = false; connection.write("235 authenticated\r\n"); }
          else if (/^EHLO/i.test(line)) connection.write("250-localhost\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN\r\n");
          else if (/^STARTTLS/i.test(line)) {
            connection.write("220 ready for TLS\r\n");
            connection.removeListener("data", onData);
            const encrypted = new tls.TLSSocket(connection, { isServer: true, secureContext });
            // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
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
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const port = (smtp.address() as net.AddressInfo).port;
  const reservation = net.createServer();
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  await new Promise<void>((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const appPort = (reservation.address() as net.AddressInfo).port;
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
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
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  app.stdout?.on("data", (data) => { appOutput += data.toString(); });
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  app.stderr?.on("data", (data) => { appOutput += data.toString(); });
  pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const email = `auth-test-${randomUUID()}@example.test`;
  let userId: string | undefined;
  {
    let ready = false;
    // i < 100 아래 작업을 반복한다.
    for (let i = 0; i < 100; i++) {
      // 확인할 조건: app의 exitCode ≠ 값 없음. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
      if (app.exitCode !== null) throw new Error(`Next.js exited: ${appOutput}`);
      // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다.
      // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
      try { await fetch(`${baseURL}/api/me`, { signal: AbortSignal.timeout(2_000) }); ready = true; break; } catch { await new Promise((resolve) => setTimeout(resolve, 300)); }
    }
    assert.ok(ready, `Next.js did not start: ${appOutput}`);
    // 테스트 요청을 서버에 보내고 응답을 확인할 수 있는 형태로 돌려준다.
    // 선택 기준: 요청 내용 있음 또는 true. 맞으면 “등록” 값을 사용하고, 아니면 “조회” 값을 사용한다.
    // 선택 기준: 요청 내용 있음 또는 true. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
    // 선택 기준: cookie 있음 또는 true. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
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
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
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
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
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
    // 분실물 수정 요청을 보내 권한과 변경 결과를 테스트한다.
    // 선택 기준: 요청 내용 있음 또는 true. 맞으면 필요한 항목을 묶은 자료를 사용하고, 아니면 필요한 항목을 묶은 자료를 사용한다.
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
