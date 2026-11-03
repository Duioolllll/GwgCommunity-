import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

let instance: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 bytes");
  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  const db = getDb();
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    databaseHooks: { session: { create: { async before(session) {
      const [account] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.userId));
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
      async sendVerificationEmail({ user, url }) {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) throw new Error("SMTP configuration is required to send verification email");
        const port = Number(SMTP_PORT);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP_PORT");
        const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
        await transport.sendMail({ from: SMTP_FROM, to: user.email, subject: "GwgCommunity 이메일 확인", text: `이메일 주소를 확인하려면 다음 링크를 여세요:\n\n${url}\n\n요청하지 않았다면 이 메일을 무시하세요.` });
      },
      async afterEmailVerification(verifiedUser) {
        await db.update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, verifiedUser.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
      },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 }, "/send-verification-email": { window: 60, max: 3 } } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  });
}

export function getAuth() {
  return instance ??= createAuth();
}

/** Read current privileges from PostgreSQL; never trust stale cookie-cached role/status. */
export async function getCurrentUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  // Repair an interrupted post-verification callback without changing suspended users.
  if (session.user.emailVerified) {
    await getDb().update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, session.user.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
  }
  const [user] = await getDb().select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, emailVerified: schema.user.emailVerified, role: schema.user.role, status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.user.id));
  return user?.status === "SUSPENDED" ? null : user ?? null;
}
