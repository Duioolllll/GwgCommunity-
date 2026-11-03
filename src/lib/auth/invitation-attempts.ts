import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { invitationAttempts } from "@/lib/db/schema";

/** Atomic per-account limit across processes and restarts, including invalid input. */
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
