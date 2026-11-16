/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { createMarketWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { listMarketPosts, marketInput } from "@/features/market/data";

// 검색 조건을 적용해 거래 글 목록을 조회한다.
// 기능 `GET`(request): 먼저 `const url = new URL(request.url);`를 실행한다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  return NextResponse.json(await listMarketPosts(getDb(), filters));
}

// 거래 글 생성 요청을 처리한다.
// 기능 `POST`(request): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export async function POST(request: Request) {
  const user = await getCurrentUser(await headers());
  // 조건 `!user`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!user.emailVerified || user.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  // 단락 분기 `body`: null 또는 undefined인 경우에만 오른쪽 `{}`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const { imageIds = [], ...fields } = body ?? {};
  const images = imageIdsInput.safeParse(imageIds);
  const result = marketInput.safeParse(fields);
  // 조건 `!result.success || !images.success`: 참이면 `errorResponse("INVALID_INPUT", "제목, 카테고리, 가격과 설명을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!result.success`: 거짓인 경우에만 오른쪽 `!images.success`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!result.success || !images.success) return errorResponse("INVALID_INPUT", "제목, 카테고리, 가격과 설명을 확인하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof InvalidAttachments` 조건을 추가로 검사한다.
  // 조건 `error instanceof InvalidAttachments`: 참이면 `errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  try { const post = await createMarketWithImages(getDb(), user.id, result.data, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
