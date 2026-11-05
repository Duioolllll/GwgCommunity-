import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createFinderWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { errorResponse, jsonBody } from "@/lib/api";
import { listFinderPosts, parseFinderInput, parseFinderFilters } from "@/features/finder/posts";

export async function GET(request: Request) {
  const filters = parseFinderFilters(new URL(request.url).searchParams);
  if (!filters) return errorResponse("INVALID_INPUT", "검색 조건을 확인하세요.", 400);
  const viewer = await getCurrentUser(await headers());
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const posts = await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters);
  return NextResponse.json({ posts: posts.slice(0, 20), page: filters.page, hasMore: posts.length > 20 });
}

export async function POST(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const viewer = await getCurrentUser(await headers());
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  const input = parseFinderInput(body);
  const images = imageIdsInput.safeParse(body?.imageIds ?? []);
  if (!input || !images.success) return errorResponse("INVALID_INPUT", "분실물 정보와 날짜를 확인하세요.", 400);
  try { const post = await createFinderWithImages(getDb(), viewer.id, input, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
