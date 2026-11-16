// 구현 미반영: 거래 당사자 메시지와 관심 목록은 없다. 이 모듈은 예약·취소·완료 상태 전환만 처리한다.
/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { marketPosts, marketReservations, user } from "@/lib/db/schema";

// 기능 `constructor`(code): 먼저 `super(code);`를 실행한다.
export class ReservationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "UNAVAILABLE") { super(code); }
}

// 학생 인증과 게시물 상태를 확인하고 조건부 갱신 및 예약 생성을 한 트랜잭션으로 묶는다.
// 기능 `reserveMarketPost`(db, postId, requesterId): `db.transaction(async (tx) => { const [requester] = await tx.select({ id: user.id }).from(user) .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))); if (!requester) throw new ReservationError("FORBIDDEN"); const [post] = await tx.update(marketPosts).set({ status: "RESERVED", updatedAt: new Date() }) .where(and(eq(marketPosts.id, postId), eq(marketPosts.status, "AVAILABLE"), ne(marketPosts.ownerId, requesterId))) .returning({ id: marketPosts.id }); if (!post) throw new ReservationError("UNAVAILABLE"); const [reservation] = await tx.insert(marketReservations).values({ postId, requesterId }).returning({ id: marketReservations.id }); return reservation; })`를 반환한다.
export async function reserveMarketPost(db: Database, postId: string, requesterId: string) {
  // 기능 `콜백`(tx): 먼저 `const [requester] = await tx.select({ id: user.id }).from(user) .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));`를 실행한다.
  return db.transaction(async (tx) => {
    const [requester] = await tx.select({ id: user.id }).from(user)
      .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
    // 조건 `!requester`: 참이면 `new ReservationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!requester) throw new ReservationError("FORBIDDEN");
    const [post] = await tx.update(marketPosts).set({ status: "RESERVED", updatedAt: new Date() })
      .where(and(eq(marketPosts.id, postId), eq(marketPosts.status, "AVAILABLE"), ne(marketPosts.ownerId, requesterId)))
      .returning({ id: marketPosts.id });
    // 조건 `!post`: 참이면 `new ReservationError("UNAVAILABLE")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!post) throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.insert(marketReservations).values({ postId, requesterId }).returning({ id: marketReservations.id });
    return reservation;
  });
}

// 예약 게시물과 활성 예약을 확인하고 권한에 따라 취소 또는 완료 상태로 전환한다.
// 기능 `transitionReservation`(db, postId, actorId, action): `db.transaction(async (tx) => { const [post] = await tx.select().from(marketPosts).where(eq(marketPosts.id, postId)).for("update"); if (!post || post.status !== "RESERVED") throw new ReservationError("UNAVAILABLE"); const [reservation] = await tx.select().from(marketReservations).where(and(eq(marketReservations.postId, postId), eq(marketReservations.status, "ACTIVE"))); if (!reservation) throw new ReservationError("UNAVAILABLE"); if (post.ownerId !== actorId && (action !== "cancel" || reservation.requesterId !== actorId)) throw new ReservationError("FORBIDDEN"); await tx.update(marketReservations).set({ status: action === "cancel" ? "CANCELLED" : "COMPLETED" }).where(eq(marketReservations.id, reservation.id)); await tx.update(marketPosts).set({ status: action === "cancel" ? "AVAILABLE" : "COMPLETED", updatedAt: new Date() }).where(eq(marketPosts.id, postId)); })`를 반환한다.
export async function transitionReservation(db: Database, postId: string, actorId: string, action: "cancel" | "complete") {
  // 기능 `콜백`(tx): 먼저 `const [post] = await tx.select().from(marketPosts).where(eq(marketPosts.id, postId)).for("update");`를 실행한다.
  return db.transaction(async (tx) => {
    const [post] = await tx.select().from(marketPosts).where(eq(marketPosts.id, postId)).for("update");
    // 조건 `!post || post.status !== "RESERVED"`: 참이면 `new ReservationError("UNAVAILABLE")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `!post`: 거짓인 경우에만 오른쪽 `post.status !== "RESERVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (!post || post.status !== "RESERVED") throw new ReservationError("UNAVAILABLE");
    const [reservation] = await tx.select().from(marketReservations).where(and(eq(marketReservations.postId, postId), eq(marketReservations.status, "ACTIVE")));
    // 조건 `!reservation`: 참이면 `new ReservationError("UNAVAILABLE")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!reservation) throw new ReservationError("UNAVAILABLE");
    // 조건 `post.ownerId !== actorId && (action !== "cancel" || reservation.requesterId !== actorId)`: 참이면 `new ReservationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `post.ownerId !== actorId`: 참인 경우에만 오른쪽 `(action !== "cancel" || reservation.requesterId !== actorId)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `action !== "cancel"`: 거짓인 경우에만 오른쪽 `reservation.requesterId !== actorId`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (post.ownerId !== actorId && (action !== "cancel" || reservation.requesterId !== actorId)) throw new ReservationError("FORBIDDEN");
    // 선택 조건 `action === "cancel"`: 참이면 `"CANCELLED"`, 거짓이면 `"COMPLETED"`를 사용한다.
    await tx.update(marketReservations).set({ status: action === "cancel" ? "CANCELLED" : "COMPLETED" }).where(eq(marketReservations.id, reservation.id));
    // 선택 조건 `action === "cancel"`: 참이면 `"AVAILABLE"`, 거짓이면 `"COMPLETED"`를 사용한다.
    await tx.update(marketPosts).set({ status: action === "cancel" ? "AVAILABLE" : "COMPLETED", updatedAt: new Date() }).where(eq(marketPosts.id, postId));
  });
}
