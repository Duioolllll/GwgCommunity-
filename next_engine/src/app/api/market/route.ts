import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createMarketWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { listMarketPosts, marketInput } from "@/features/market/data";

// 검색 조건을 적용해 거래 글 목록을 불러온다.
// 조회 요청을 받아 중고거래 처리를 하고 결과를 돌려준다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  return NextResponse.json(await listMarketPosts(getDb(), filters));
}

// 거래 글 생성 요청을 처리한다.
// 등록 요청을 받아 중고거래 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  const user = await getCurrentUser(await headers());
  // 로그인한 사용자를 찾지 못하면 로그인이 필요하다고 알리고 요청을 거절한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 이메일 인증과 학생 인증을 모두 마친 사용자만 이 기능을 이용할 수 있다.
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  // 이미지 번호와 글 내용을 나눈다. 본문이 없으면 빈 자료로 보고 뒤의 입력 검사에서 확인한다.
  const { imageIds = [], ...fields } = body ?? {};
  const images = imageIdsInput.safeParse(imageIds);
  const result = marketInput.safeParse(fields);
  // 글 내용이나 첨부 이미지 번호가 입력 규칙에 맞지 않으면 저장하지 않고 다시 확인하도록 안내한다.
  if (!result.success || !images.success) return errorResponse("INVALID_INPUT", "제목, 카테고리, 가격과 설명을 확인하세요.", 400);
  // 거래 글과 이미지를 함께 저장한다. 남의 이미지이거나 이미 다른 글에 연결된 이미지면 저장을 거절한다.
  try { const post = await createMarketWithImages(getDb(), user.id, result.data, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
