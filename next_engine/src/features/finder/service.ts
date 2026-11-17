import { and, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts, user } from "@/lib/db/schema";
import { rankFinderMatches } from "./matching";
import type { FinderInput } from "./posts";

// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class FinderMatchError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND") { super(code); }
}

// 이 기능에서 생긴 오류의 종류와 원인을 다른 코드에 전달한다.
export class FinderMutationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}

/** 요청자 번호는 로그인 정보에서 가져와야 한다. 사용자가 본문에 적은 번호를 그대로 믿지 않는다. */
// 인증된 작성자만 수정·종료·삭제할 수 있으며 수정 시 공개 심사를 다시 요청한다.
// 작성자와 글 상태를 확인해 분실물 글을 수정·종료·삭제한다.
export async function mutateFinderPost(db: Database, postId: string, actorId: string, action: { type: "edit"; input: FinderInput } | { type: "close" } | { type: "delete" }) {
  // 아래 저장 작업을 한 묶음으로 처리해 중간에 실패하면 함께 취소한다.
  return db.transaction(async tx => {
    const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, actorId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))).for("update");
    // 확인할 조건: 요청한 사용자 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
    if (!actor) throw new FinderMutationError("FORBIDDEN");
    const [post] = await tx.select({ ownerId: finderPosts.ownerId, status: finderPosts.status }).from(finderPosts).where(eq(finderPosts.id, postId)).for("update");
    // 확인할 조건: 게시글 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
    if (!post) throw new FinderMutationError("NOT_FOUND");
    // 확인할 조건: 게시글의 작성자 번호 ≠ 요청한 사용자의 고유 번호. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
    if (post.ownerId !== actor.id) throw new FinderMutationError("FORBIDDEN");
    // 확인할 조건: (선택한 작업의 종류 ≠ “삭제”) 그리고 (게시글의 상태 ≠ “진행 중”). 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
    if (action.type !== "delete" && post.status !== "ACTIVE") throw new FinderMutationError("CONFLICT");
    // 확인할 조건: 선택한 작업의 종류 = “삭제”. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 추가 조건을 한 번 더 확인한다.
    // 확인할 조건: 선택한 작업의 종류 = “종료”. 해당하면 아래에 있는 작업을 실행한다. 해당하지 않으면 아래에 있는 작업을 실행한다.
    if (action.type === "delete") {
      await tx.delete(finderPosts).where(eq(finderPosts.id, postId));
    } else if (action.type === "close") {
      await tx.update(finderPosts).set({ status: "CLOSED" }).where(eq(finderPosts.id, postId));
    } else {
      // 승인받은 글이라도 공개 내용이 바뀌면 다시 심사를 받아야 한다.
      await tx.update(finderPosts).set({ ...action.input, publicApproval: "PENDING" }).where(eq(finderPosts.id, postId));
    }
  });
}

/** 로그인을 확인한 요청에서만 호출한다. 요청자 번호도 로그인 정보에서 가져온다. */
// 인증 및 소유자 또는 관리자 권한을 확인한 뒤 볼 수 있는 후보의 유사도를 순위화한다.
// 요청한 사람이 글의 작성자인지 확인하고 비슷한 반대 종류 글을 찾는다.
export async function getFinderMatches(db: Database, postId: string, requesterId: string, limit = 20) {
  const [requester] = await db.select({ id: user.id, role: user.role }).from(user)
    .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
  // 이메일과 학생 인증이 끝난 신청자를 찾지 못하면 예약을 거절한다.
  if (!requester) throw new FinderMatchError("FORBIDDEN");
  const [source] = await db.select().from(finderPosts).where(eq(finderPosts.id, postId));
  // 확인할 조건: 기준 글 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!source) throw new FinderMatchError("NOT_FOUND");
  // 확인할 조건: (기준 글의 작성자 번호 ≠ 예약 신청자의 고유 번호) 그리고 (예약 신청자의 권한 ≠ “관리자”). 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (source.ownerId !== requester.id && requester.role !== "admin") throw new FinderMatchError("FORBIDDEN");
  // 이미 종료한 글에는 추천 후보를 보여주지 않는다.
  if (source.status !== "ACTIVE") return [];
  // 선택 기준: 기준 글의 분실·습득 종류 = “분실”. 맞으면 “습득” 값을 사용하고, 아니면 “분실” 값을 사용한다.
  const candidates = await db.select({
    id: finderPosts.id, kind: finderPosts.kind, status: finderPosts.status,
    title: finderPosts.title, category: finderPosts.category, color: finderPosts.color,
    generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt,
    createdAt: finderPosts.createdAt,
  }).from(finderPosts).where(and(eq(finderPosts.kind, source.kind === "lost" ? "found" : "lost"), eq(finderPosts.status, "ACTIVE"), ne(finderPosts.id, source.id),
    or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, requester.id))));
  return rankFinderMatches(source, candidates, limit);
}
