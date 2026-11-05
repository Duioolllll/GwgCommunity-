import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { marketPosts } from "@/lib/db/schema";
import { marketId, marketInput } from "@/features/market/data";

type Params = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const [post] = await getDb().select({ id: marketPosts.id, title: marketPosts.title, description: marketPosts.description, category: marketPosts.category, price: marketPosts.price, status: marketPosts.status, createdAt: marketPosts.createdAt }).from(marketPosts).where(eq(marketPosts.id, id));
  if (!post) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  return NextResponse.json({ post });
}
async function authorized(id: string) {
  const current = await getCurrentUser(await headers());
  if (!current) return { error: errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401) };
  if (!current.emailVerified || current.status !== "ACTIVE_STUDENT") return { error: errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403) };
  const [post] = await getDb().select({ ownerId: marketPosts.ownerId, status: marketPosts.status }).from(marketPosts).where(eq(marketPosts.id, id));
  if (!post) return { error: errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404) };
  if (post.ownerId !== current.id) return { error: errorResponse("FORBIDDEN", "작성자만 변경할 수 있습니다.", 403) };
  if (post.status !== "AVAILABLE") return { error: errorResponse("CONFLICT", "예약 중이거나 거래 완료된 상품은 변경할 수 없습니다.", 409) };
  return { user: current };
}
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const access = await authorized(id);
  if (access.error) return access.error;
  const result = marketInput.safeParse(await jsonBody(request));
  if (!result.success) return errorResponse("INVALID_INPUT", "상품 정보를 확인하세요.", 400);
  const updated = await getDb().update(marketPosts).set({ ...result.data, updatedAt: new Date() }).where(and(eq(marketPosts.id, id), eq(marketPosts.ownerId, access.user.id), eq(marketPosts.status, "AVAILABLE"))).returning({ id: marketPosts.id });
  if (!updated.length) return errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409);
  return NextResponse.json({ post: updated[0] });
}
export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const access = await authorized(id);
  if (access.error) return access.error;
  const deleted = await getDb().delete(marketPosts).where(and(eq(marketPosts.id, id), eq(marketPosts.ownerId, access.user.id), eq(marketPosts.status, "AVAILABLE"))).returning({ id: marketPosts.id });
  if (!deleted.length) return errorResponse("CONFLICT", "상품 상태가 변경되었습니다. 다시 확인하세요.", 409);
  return NextResponse.json({ ok: true });
}
