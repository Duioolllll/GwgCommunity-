import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

let instance: ReturnType<typeof createAuth> | undefined;

// 비밀키와 기준 URL을 확인한 뒤 DB·메일 연동 인증을 구성한다.
// 가입·로그인·인증 메일에 필요한 설정과 처리 방법을 정한다.
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  // 인증용 비밀키가 없거나 32바이트보다 짧으면 안전한 로그인을 구성할 수 없어 시작을 중단한다.
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 bytes");
  // 서비스 주소 설정이 없으면 인증 링크를 만들 수 없으므로 중단한다.
  if (!baseURL) throw new Error("BETTER_AUTH_URL is required");
  const db = getDb();
  // 로그인 정보를 만들기 전에 계정이 정지되었는지 확인한다.
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    databaseHooks: { session: { create: { async before(session) {
      const [account] = await db.select({ status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.userId));
      // 계정이 없거나 정지된 계정이면 로그인을 허용하지 않는다.
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
      // 이메일 확인 링크가 담긴 메일을 보낸다.
      async sendVerificationEmail({ user, url }) {
        const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
        // 메일 발송에 필요한 서버·계정·발신 주소 중 빠진 항목이 있으면 메일을 보내지 않는다.
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) throw new Error("SMTP configuration is required to send verification email");
        const port = Number(SMTP_PORT);
        // 확인할 조건: ((port이 정수임 조건을 만족하지 않음) 또는 (port < 1)) 또는 (port > 65535). 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid SMTP_PORT");
        const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD } });
        await transport.sendMail({ from: SMTP_FROM, to: user.email, subject: "GwgCommunity 이메일 확인", text: `이메일 주소를 확인하려면 다음 링크를 여세요:\n\n${url}\n\n요청하지 않았다면 이 메일을 무시하세요.` });
      },
      // 이메일 확인을 마친 계정을 초대 코드 입력 대기 상태로 바꾼다.
      async afterEmailVerification(verifiedUser) {
        await db.update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, verifiedUser.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
      },
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 }, "/send-verification-email": { window: 60, max: 3 } } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  });
}

// 이미 만든 인증 도구가 있으면 재사용하고 없으면 만든다.
export function getAuth() {
  return instance ??= createAuth();
}

/** 권한과 계정 상태는 PostgreSQL에서 다시 확인한다. 오래된 로그인 쿠키 정보만 믿고 권한을 허용하지 않는다. */
// 현재 로그인한 사용자를 찾고 정지된 계정은 제외한다.
export async function getCurrentUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  // 확인할 조건: 로그인 정보 없음 또는 false. 해당하면 사용할 수 있는 값이 없다고 알린다.
  if (!session) return null;
  // 이메일 확인 후 처리가 중간에 끊긴 계정을 보완하되 정지된 계정의 상태는 바꾸지 않는다.
  // 확인할 조건: 로그인 정보의 사용자의 이메일 인증 여부 있음 또는 true. 해당하면 아래에 있는 작업을 실행한다.
  if (session.user.emailVerified) {
    await getDb().update(schema.user).set({ status: "VERIFIED_PENDING_INVITE", updatedAt: new Date() }).where(and(eq(schema.user.id, session.user.id), eq(schema.user.status, "UNVERIFIED_EMAIL")));
  }
  const [user] = await getDb().select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, emailVerified: schema.user.emailVerified, role: schema.user.role, status: schema.user.status }).from(schema.user).where(eq(schema.user.id, session.user.id));
  return user?.status === "SUSPENDED" ? null : user ?? null;
}
