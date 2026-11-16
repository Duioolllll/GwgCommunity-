/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createFinderWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { errorResponse, jsonBody } from "@/lib/api";
import { listFinderPosts, parseFinderInput, parseFinderFilters } from "@/features/finder/posts";

// 공개 범위와 검색 조건을 적용해 분실물 목록을 조회한다.
// 기능 `GET`(request): 먼저 `const filters = parseFinderFilters(new URL(request.url).searchParams);`를 실행한다.
export async function GET(request: Request) {
  const filters = parseFinderFilters(new URL(request.url).searchParams);
  // 조건 `!filters`: 참이면 `errorResponse("INVALID_INPUT", "검색 조건을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!filters) return errorResponse("INVALID_INPUT", "검색 조건을 확인하세요.", 400);
  const viewer = await getCurrentUser(await headers());
  // 선택 조건 `viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT"`: 참이면 `viewer.id`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const posts = await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters);
  return NextResponse.json({ posts: posts.slice(0, 20), page: filters.page, hasMore: posts.length > 20 });
}

// 인증된 사용자의 분실물 등록 요청을 처리한다.
// 기능 `POST`(request): `!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")` 조건을 추가로 검사한다.
export async function POST(request: Request) {
  // 조건 `!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")`: 참이면 `errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `request.headers.get("content-type")`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  const input = parseFinderInput(body);
  // 단락 분기 `body?.imageIds`: null 또는 undefined인 경우에만 오른쪽 `[]`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const images = imageIdsInput.safeParse(body?.imageIds ?? []);
  // 조건 `!input || !images.success`: 참이면 `errorResponse("INVALID_INPUT", "분실물 정보와 날짜를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!input`: 거짓인 경우에만 오른쪽 `!images.success`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!input || !images.success) return errorResponse("INVALID_INPUT", "분실물 정보와 날짜를 확인하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof InvalidAttachments` 조건을 추가로 검사한다.
  // 조건 `error instanceof InvalidAttachments`: 참이면 `errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  try { const post = await createFinderWithImages(getDb(), viewer.id, input, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
