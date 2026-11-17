import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { invitationAttempts } from "@/lib/db/schema";

/** 잘못된 코드 입력도 시도 횟수에 포함한다. 여러 서버가 동시에 처리하거나 재시작해도 계정별 제한이 유지되도록 데이터베이스에 기록한다. */
// 초대 코드 사용 시도 제한을 적용한다.
// 초대 코드를 너무 많이 입력하지 못하도록 시도 횟수를 기록한다.
export async function consumeInvitationAttempt(db: Database, userId: string): Promise<boolean> {
  const rows = await db.insert(invitationAttempts)
    .values({ userId, count: 1, windowStart: new Date() })
    .onConflictDoUpdate({
      target: invitationAttempts.userId,
      set: {
        count: sql`CASE WHEN ${invitationAttempts.windowStart} <= now() - interval '15 minutes' THEN 1 ELSE ${invitationAttempts.count} + 1 END`,
        windowStart: sql`CASE WHEN ${invitationAttempts.windowStart} <= now() - interval '15 minutes' THEN now() ELSE ${invitationAttempts.windowStart} END`,
      },
      setWhere: sql`${invitationAttempts.windowStart} <= now() - interval '15 minutes' OR ${invitationAttempts.count} < 5`,
    }).returning({ userId: invitationAttempts.userId });
  return rows.length === 1;
}
