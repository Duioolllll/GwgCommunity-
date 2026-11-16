/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq, ne, or } from "drizzle-orm";
import type { Database } from "@/lib/db/types";
import { finderPosts, user } from "@/lib/db/schema";
import { rankFinderMatches } from "./matching";
import type { FinderInput } from "./posts";

// 기능 `constructor`(code): 먼저 `super(code);`를 실행한다.
export class FinderMatchError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND") { super(code); }
}

// 기능 `constructor`(code): 먼저 `super(code);`를 실행한다.
export class FinderMutationError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT") { super(code); }
}

/** Session identity must be supplied by the caller, never from the request body. */
// 인증된 작성자만 수정·종료·삭제할 수 있으며 수정 시 공개 심사를 다시 요청한다.
// 기능 `mutateFinderPost`(db, postId, actorId, action): `db.transaction(async tx => { const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, actorId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))).for("update"); if (!actor) throw new FinderMutationError("FORBIDDEN"); const [post] = await tx.select({ ownerId: finderPosts.ownerId, status: finderPosts.status }).from(finderPosts).where(eq(finderPosts.id, postId)).for("update"); if (!post) throw new FinderMutationError("NOT_FOUND"); if (post.ownerId !== actor.id) throw new FinderMutationError("FORBIDDEN"); if (action.type !== "delete" && post.status !== "ACTIVE") throw new FinderMutationError("CONFLICT"); if (action.type === "delete") { await tx.delete(finderPosts).where(eq(finderPosts.id, postId)); } else if (action.type === "close") { await tx.update(finderPosts).set({ status: "CLOSED" }).where(eq(finderPosts.id, postId)); } else { // A previously reviewed post must be reviewed again after its public content changes. await tx.update(finderPosts).set({ ...action.input, publicApproval: "PENDING" }).where(eq(finderPosts.id, postId)); } })`를 반환한다.
export async function mutateFinderPost(db: Database, postId: string, actorId: string, action: { type: "edit"; input: FinderInput } | { type: "close" } | { type: "delete" }) {
  // 기능 `콜백`(tx): 먼저 `const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, actorId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))).for("update");`를 실행한다.
  return db.transaction(async tx => {
    const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, actorId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true))).for("update");
    // 조건 `!actor`: 참이면 `new FinderMutationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!actor) throw new FinderMutationError("FORBIDDEN");
    const [post] = await tx.select({ ownerId: finderPosts.ownerId, status: finderPosts.status }).from(finderPosts).where(eq(finderPosts.id, postId)).for("update");
    // 조건 `!post`: 참이면 `new FinderMutationError("NOT_FOUND")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!post) throw new FinderMutationError("NOT_FOUND");
    // 조건 `post.ownerId !== actor.id`: 참이면 `new FinderMutationError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (post.ownerId !== actor.id) throw new FinderMutationError("FORBIDDEN");
    // 조건 `action.type !== "delete" && post.status !== "ACTIVE"`: 참이면 `new FinderMutationError("CONFLICT")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `action.type !== "delete"`: 참인 경우에만 오른쪽 `post.status !== "ACTIVE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (action.type !== "delete" && post.status !== "ACTIVE") throw new FinderMutationError("CONFLICT");
    // 조건 `action.type === "delete"`: 참이면 먼저 `await tx.delete(finderPosts).where(eq(finderPosts.id, postId));`를 실행한다. 거짓이면 `action.type === "close"` 조건을 추가로 검사한다.
    // 조건 `action.type === "close"`: 참이면 먼저 `await tx.update(finderPosts).set({ status: "CLOSED" }).where(eq(finderPosts.id, postId));`를 실행한다. 거짓이면 먼저 `await tx.update(finderPosts).set({ ...action.input, publicApproval: "PENDING" }).where(eq(finderPosts.id, postId));`를 실행한다.
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
// 인증 및 소유자 또는 관리자 권한을 확인한 뒤 볼 수 있는 후보의 유사도를 순위화한다.
// 기능 `getFinderMatches`(db, postId, requesterId, limit): 먼저 `const [requester] = await db.select({ id: user.id, role: user.role }).from(user) .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));`를 실행한다.
export async function getFinderMatches(db: Database, postId: string, requesterId: string, limit = 20) {
  const [requester] = await db.select({ id: user.id, role: user.role }).from(user)
    .where(and(eq(user.id, requesterId), eq(user.status, "ACTIVE_STUDENT"), eq(user.emailVerified, true)));
  // 조건 `!requester`: 참이면 `new FinderMatchError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!requester) throw new FinderMatchError("FORBIDDEN");
  const [source] = await db.select().from(finderPosts).where(eq(finderPosts.id, postId));
  // 조건 `!source`: 참이면 `new FinderMatchError("NOT_FOUND")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!source) throw new FinderMatchError("NOT_FOUND");
  // 조건 `source.ownerId !== requester.id && requester.role !== "admin"`: 참이면 `new FinderMatchError("FORBIDDEN")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `source.ownerId !== requester.id`: 참인 경우에만 오른쪽 `requester.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (source.ownerId !== requester.id && requester.role !== "admin") throw new FinderMatchError("FORBIDDEN");
  // 조건 `source.status !== "ACTIVE"`: 참이면 `[]`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (source.status !== "ACTIVE") return [];
  // 선택 조건 `source.kind === "lost"`: 참이면 `"found"`, 거짓이면 `"lost"`를 사용한다.
  const candidates = await db.select({
    id: finderPosts.id, kind: finderPosts.kind, status: finderPosts.status,
    title: finderPosts.title, category: finderPosts.category, color: finderPosts.color,
    generalLocation: finderPosts.generalLocation, occurredAt: finderPosts.occurredAt,
    createdAt: finderPosts.createdAt,
  }).from(finderPosts).where(and(eq(finderPosts.kind, source.kind === "lost" ? "found" : "lost"), eq(finderPosts.status, "ACTIVE"), ne(finderPosts.id, source.id),
    or(eq(finderPosts.publicApproval, "APPROVED"), eq(finderPosts.ownerId, requester.id))));
  return rankFinderMatches(source, candidates, limit);
}
