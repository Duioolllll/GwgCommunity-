/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { marketPosts } from "@/lib/db/schema";
import { marketId, marketInput } from "@/features/market/data";

type Params = { params: Promise<{ id: string }> };
// 거래 글 상세 조회 요청을 처리한다.
// 기능 `GET`(_, { params }): 먼저 `const { id } = await params;`를 실행한다.
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 `errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const [post] = await getDb().select({ id: marketPosts.id, title: marketPosts.title, description: marketPosts.description, category: marketPosts.category, price: marketPosts.price, status: marketPosts.status, createdAt: marketPosts.createdAt }).from(marketPosts).where(eq(marketPosts.id, id));
  // 조건 `!post`: 참이면 `errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!post) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  return NextResponse.json({ post });
}
// 기능 `authorized`(id): 먼저 `const current = await getCurrentUser(await headers());`를 실행한다.
async function authorized(id: string) {
  const current = await getCurrentUser(await headers());
  // 조건 `!current`: 참이면 `{ error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!current) return { error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) };
  // 조건 `!current.emailVerified || current.status !== "ACTIVE_STUDENT"`: 참이면 `{ error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!current.emailVerified`: 거짓인 경우에만 오른쪽 `current.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!current.emailVerified || current.status !== "ACTIVE_STUDENT") return { error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) };
  const [post] = await getDb().select({ ownerId: marketPosts.ownerId, status: marketPosts.status }).from(marketPosts).where(eq(marketPosts.id, id));
  // 조건 `!post`: 참이면 `{ error: errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404) }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!post) return { error: errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404) };
  // 조건 `post.ownerId !== current.id`: 참이면 `{ error: errorResponse("FORBIDDEN", "작성자만 변경할 수 있습니다.", 403) }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (post.ownerId !== current.id) return { error: errorResponse("FORBIDDEN", "작성자만 변경할 수 있습니다.", 403) };
  // 조건 `post.status !== "AVAILABLE"`: 참이면 `{ error: errorResponse("CONFLICT", "예약 중이거나 거래 완료된 상품은 변경할 수 없습니다.", 409) }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (post.status !== "AVAILABLE") return { error: errorResponse("CONFLICT", "예약 중이거나 거래 완료된 상품은 변경할 수 없습니다.", 409) };
  return { user: current };
}
// 거래 글 수정 요청을 처리한다.
// 기능 `PATCH`(request, { params }): 먼저 `const { id } = await params;`를 실행한다.
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 `errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const access = await authorized(id);
  // 조건 `access.error`: 참이면 `access.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (access.error) return access.error;
  const result = marketInput.safeParse(await jsonBody(request));
  // 조건 `!result.success`: 참이면 `errorResponse("INVALID_INPUT", "상품 정보를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!result.success) return errorResponse("INVALID_INPUT", "상품 정보를 확인하세요.", 400);
  const updated = await getDb().update(marketPosts).set({ ...result.data, updatedAt: new Date() }).where(and(eq(marketPosts.id, id), eq(marketPosts.ownerId, access.user.id), eq(marketPosts.status, "AVAILABLE"))).returning({ id: marketPosts.id });
  // 조건 `!updated.length`: 참이면 `errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!updated.length) return errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409);
  return NextResponse.json({ post: updated[0] });
}
// 거래 글 삭제 요청을 처리한다.
// 기능 `DELETE`(_, { params }): 먼저 `const { id } = await params;`를 실행한다.
export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 `errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const access = await authorized(id);
  // 조건 `access.error`: 참이면 `access.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (access.error) return access.error;
  const deleted = await getDb().delete(marketPosts).where(and(eq(marketPosts.id, id), eq(marketPosts.ownerId, access.user.id), eq(marketPosts.status, "AVAILABLE"))).returning({ id: marketPosts.id });
  // 조건 `!deleted.length`: 참이면 `errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!deleted.length) return errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409);
  return NextResponse.json({ ok: true });
}
