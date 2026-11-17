// 구현 미반영: 거래 당사자 메시지와 관심 목록은 없다. 이 모듈은 예약·취소·완료 상태 변경만 처리한다.
import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { marketPosts, marketReservations, user } from "@/lib/db/schema";

// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class ReservationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "UNAVAILABLE") { super(code); }
}

// 학생 인증과 게시물 상태를 확인하고 조건부 갱신 및 예약 생성을 한 번에 성공하거나 함께 취소되는 저장 작업으로 묶는다.
// 본인 글이 아닌 판매 중 글에 예약을 만들고 중복 예약을 막는다.
export async function reserveMarketPost(db: Database, postId: string, requesterId: string) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async (tx) => {
    const [requester] = await tx.select({ id: user.id }).from(user)
      .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
    // 이메일과 학생 인증이 끝난 신청자를 찾지 못하면 예약을 거절한다.
    if (!requester) throw new ReservationError("FORBIDDEN");
    const [post] = await tx.update(marketPosts).set({ status: "RESERVED", updatedAt: new Date() })
      .where(and(eq(marketPosts.id, postId), eq(marketPosts.status, "AVAILABLE"), ne(marketPosts.ownerId, requesterId)))
      .returning({ id: marketPosts.id });
    // 판매 중이 아니거나 본인 글이라 예약 상태로 바꾸지 못하면 예약 불가 오류를 알린다.
    if (!post) throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.insert(marketReservations).values({ postId, requesterId }).returning({ id: marketReservations.id });
    return reservation;
  });
}

// 예약 게시물과 활성 예약을 확인하고 권한에 따라 취소 또는 완료 상태로 전환한다.
// 예약 당사자와 현재 상태를 확인해 예약을 취소하거나 거래를 끝낸다.
export async function transitionReservation(db: Database, postId: string, actorId: string, action: "cancel" | "complete") {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async (tx) => {
    const [post] = await tx.select().from(marketPosts).where(eq(marketPosts.id, postId)).for("update");
    // 글이 없거나 예약 중인 상태가 아니면 취소·완료 처리를 할 수 없다.
    if (!post || post.status !== "RESERVED") throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.select().from(marketReservations).where(and(eq(marketReservations.postId, postId), eq(marketReservations.status, "ACTIVE")));
    // 진행 중인 예약이 없으면 취소하거나 완료할 대상이 없으므로 중단한다.
    if (!reservation) throw new ReservationError("UNAVAILABLE");
    // 작성자는 예약을 취소하거나 완료할 수 있다. 신청자는 자신의 예약을 취소하는 경우에만 처리할 수 있다.
    if (post.ownerId !== actorId && (action !== "cancel" || reservation.requesterId !== actorId)) throw new ReservationError("FORBIDDEN");
    // 예약 취소를 골랐으면 예약 기록을 취소 상태로, 거래 완료를 골랐으면 완료 상태로 바꾼다.
    await tx.update(marketReservations).set({ status: action === "cancel" ? "CANCELLED" : "COMPLETED" }).where(eq(marketReservations.id, reservation.id));
    // 예약을 취소하면 글을 다시 판매 중으로 돌린다. 거래가 끝났으면 글도 완료 상태로 바꾼다.
    await tx.update(marketPosts).set({ status: action === "cancel" ? "AVAILABLE" : "COMPLETED", updatedAt: new Date() }).where(eq(marketPosts.id, postId));
  });
}
