import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { marketPosts, marketReservations, user } from "@/lib/db/schema";

export class ReservationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "UNAVAILABLE") { super(code); }
}

export async function reserveMarketPost(db: Database, postId: string, requesterId: string) {
  return db.transaction(async (tx) => {
    const [requester] = await tx.select({ id: user.id }).from(user)
      .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
    if (!requester) throw new ReservationError("FORBIDDEN");
    const [post] = await tx.update(marketPosts).set({ status: "RESERVED", updatedAt: new Date() })
      .where(and(eq(marketPosts.id, postId), eq(marketPosts.status, "AVAILABLE"), ne(marketPosts.ownerId, requesterId)))
      .returning({ id: marketPosts.id });
    if (!post) throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.insert(marketReservations).values({ postId, requesterId }).returning({ id: marketReservations.id });
    return reservation;
  });
}

export async function transitionReservation(db: Database, postId: string, actorId: string, action: "cancel" | "complete") {
  return db.transaction(async (tx) => {
    const [post] = await tx.select().from(marketPosts).where(eq(marketPosts.id, postId)).for("update");
    if (!post || post.status !== "RESERVED") throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.select().from(marketReservations).where(and(eq(marketReservations.postId, postId), eq(marketReservations.status, "ACTIVE")));
    if (!reservation) throw new ReservationError("UNAVAILABLE");
    if (post.ownerId !== actorId && (action !== "cancel" || reservation.requesterId !== actorId)) throw new ReservationError("FORBIDDEN");
    await tx.update(marketReservations).set({ status: action === "cancel" ? "CANCELLED" : "COMPLETED" }).where(eq(marketReservations.id, reservation.id));
    await tx.update(marketPosts).set({ status: action === "cancel" ? "AVAILABLE" : "COMPLETED", updatedAt: new Date() }).where(eq(marketPosts.id, postId));
  });
}
