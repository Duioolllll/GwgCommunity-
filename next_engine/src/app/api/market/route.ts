import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createMarketWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { listMarketPosts, marketInput } from "@/features/market/data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  return NextResponse.json(await listMarketPosts(getDb(), filters));
}

export async function POST(request: Request) {
  const user = await getCurrentUser(await headers());
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  const { imageIds = [], ...fields } = body ?? {};
  const images = imageIdsInput.safeParse(imageIds);
  const result = marketInput.safeParse(fields);
  if (!result.success || !images.success) return errorResponse("INVALID_INPUT", "제목, 카테고리, 가격과 설명을 확인하세요.", 400);
  try { const post = await createMarketWithImages(getDb(), user.id, result.data, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
