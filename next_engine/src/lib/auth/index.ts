/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

let instance: ReturnType<typeof createAuth> | undefined;

// 비밀키와 기준 URL을 확인한 뒤 DB·메일 연동 인증을 구성한다.
// 기능 `createAuth`(): 먼저 `const secret = process.env.BETTER_AUTH_SECRET;`를 실행한다.
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  // 조건 `!secret || Buffer.byteLength(secret) < 32`: 참이면 `new Error("BETTER_AUTH_SECRET must contain at least 32 bytes")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!secret`: 거짓인 경우에만 오른쪽 `Buffer.byteLength(secret) < 32`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 bytes");
  // 조건 `!baseURL`: 참이면 `new Error("BETTER_AUTH_URL is required")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  const db = getDb();
  // 기능 `before`(session): 먼저 `const [account] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.userId));`를 실행한다.
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    databaseHooks: { session: { create: { async before(session) {
      const [account] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.userId));
      // 조건 `!account || account.status === "SUSPENDED"`: 참이면 `new APIError("FORBIDDEN", { message: "로그인할 수 없는 계정입니다." })` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
      // 단락 분기 `!account`: 거짓인 경우에만 오른쪽 `account.status === "SUSPENDED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
      if (!account || account.status === "SUSPENDED") throw new APIError("FORBIDDEN", { message: "로그인할 수 없는 계정입니다." });
    } } } },
    user: { additionalFields: {
      role: { type: "string", required: false, defaultValue: "student", input: false },
      status: { type: "string", required: false, defaultValue: "UNVERIFIED_EMAIL", input: false },
    } },
    emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 8, maxPasswordLength: 128 },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      // 기능 `sendVerificationEmail`({ user, url }): 먼저 `const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;`를 실행한다.
      async sendVerificationEmail({ user, url }) {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
        // 조건 `!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM`: 참이면 `new Error("SMTP configuration is required to send verification email")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
        // 단락 분기 `!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD`: 거짓인 경우에만 오른쪽 `!SMTP_FROM`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        // 단락 분기 `!SMTP_HOST || !SMTP_PORT || !SMTP_USER`: 거짓인 경우에만 오른쪽 `!SMTP_PASSWORD`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        // 단락 분기 `!SMTP_HOST || !SMTP_PORT`: 거짓인 경우에만 오른쪽 `!SMTP_USER`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        // 단락 분기 `!SMTP_HOST`: 거짓인 경우에만 오른쪽 `!SMTP_PORT`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) throw new Error("SMTP configuration is required to send verification email");
        const port = Number(SMTP_PORT);
        // 조건 `!Number.isInteger(port) || port < 1 || port > 65535`: 참이면 `new Error("Invalid SMTP_PORT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
        // 단락 분기 `!Number.isInteger(port) || port < 1`: 거짓인 경우에만 오른쪽 `port > 65535`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        // 단락 분기 `!Number.isInteger(port)`: 거짓인 경우에만 오른쪽 `port < 1`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP_PORT");
        const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
        await transport.sendMail({ from: SMTP_FROM, to: user.email, subject: "GwgCommunity 이메일 확인", text: `이메일 주소를 확인하려면 다음 링크를 여세요:\n\n${url}\n\n요청하지 않았다면 이 메일을 무시하세요.` });
      },
      // 기능 `afterEmailVerification`(verifiedUser): 먼저 `await db.update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, verifiedUser.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));`를 실행한다.
      async afterEmailVerification(verifiedUser) {
        await db.update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, verifiedUser.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
      },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 }, "/send-verification-email": { window: 60, max: 3 } } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  });
}

// 기능 `getAuth`(): `instance ??= createAuth()`를 반환한다.
export function getAuth() {
  return instance ??= createAuth();
}

/** Read current privileges from PostgreSQL; never trust stale cookie-cached role/status. */
// 기능 `getCurrentUser`(requestHeaders): 먼저 `const session = await getAuth().api.getSession({ headers: requestHeaders });`를 실행한다.
export async function getCurrentUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  // 조건 `!session`: 참이면 `null`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!session) return null;
  // Repair an interrupted post-verification callback without changing suspended users.
  // 조건 `session.user.emailVerified`: 참이면 먼저 `await getDb().update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, session.user.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (session.user.emailVerified) {
    await getDb().update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, session.user.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
  }
  const [user] = await getDb().select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, emailVerified: schema.user.emailVerified, role: schema.user.role, status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.user.id));
  // 선택 조건 `user?.status === "SUSPENDED"`: 참이면 `null`, 거짓이면 `user ?? null`를 사용한다.
  // 단락 분기 `user`: null 또는 undefined인 경우에만 오른쪽 `null`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return user?.status === "SUSPENDED" ? null : user ?? null;
}
