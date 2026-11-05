import { and, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts, user } from "@/lib/db/schema";
import { rankFinderMatches } from "./matching";
import type { FinderInput } from "./posts";

export class FinderMatchError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND") { super(code); }
}

export class FinderMutationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}

/** Session identity must be supplied by the caller, never from the request body. */
export async function mutateFinderPost(db: Database, postId: string, actorId: string, action: { type: "edit"; input: FinderInput } | { type: "close" } | { type: "delete" }) {
  return db.transaction(async tx => {
    const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, actorId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))).for("update");
    if (!actor) throw new FinderMutationError("FORBIDDEN");
    const [post] = await tx.select({ ownerId: finderPosts.ownerId, status: finderPosts.status }).from(finderPosts).where(eq(finderPosts.id, postId)).for("update");
    if (!post) throw new FinderMutationError("NOT_FOUND");
    if (post.ownerId !== actor.id) throw new FinderMutationError("FORBIDDEN");
    if (action.type !== "delete" && post.status !== "ACTIVE") throw new FinderMutationError("CONFLICT");
    if (action.type === "delete") {
      await tx.delete(finderPosts).where(eq(finderPosts.id, postId));
    } else if (action.type === "close") {
      await tx.update(finderPosts).set({ status: "CLOSED" }).where(eq(finderPosts.id, postId));
    } else {
      // A previously reviewed post must be reviewed again after its public content changes.
      await tx.update(finderPosts).set({ ...action.input, publicApproval: "PENDING" }).where(eq(finderPosts.id, postId));
    }
  });
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
