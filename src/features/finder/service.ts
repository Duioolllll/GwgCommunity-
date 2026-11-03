import { and, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts, user } from "@/lib/db/schema";
import { rankFinderMatches } from "./matching";

export class FinderMatchError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND") { super(code); }
}

/** Call only from a session-authenticated endpoint; requesterId must come from the session. */
export async function getFinderMatches(db: Database, postId: string, requesterId: string, limit = 20) {
  const [requester] = await db.select({ id: user.id, role: user.role }).from(user)
    .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
  if (!requester) throw new FinderMatchError("FORBIDDEN");
  const [source] = await db.select().from(finderPosts).where(eq(finderPosts.id, postId));
  if (!source) throw new FinderMatchError("NOT_FOUND");
  if (source.ownerId !== requester.id && requester.role !== "admin") throw new FinderMatchError("FORBIDDEN");
  if (source.status !== "ACTIVE") return [];
  const candidates = await db.select({
    id: finderPosts.id, kind: finderPosts.kind, status: finderPosts.status,
    title: finderPosts.title, category: finderPosts.category, color: finderPosts.color,
    generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt,
    createdAt: finderPosts.createdAt,
  }).from(finderPosts).where(and(eq(finderPosts.kind, source.kind === "lost" ? "found" : "lost"), eq(finderPosts.status, "ACTIVE"), ne(finderPosts.id, source.id),
    or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, requester.id))));
  return rankFinderMatches(source, candidates, limit);
}
