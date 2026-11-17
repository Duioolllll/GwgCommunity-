import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createFinderWithImages, imageIdsInput, InvalidAttachments } from "@/lib/storage/attachments";
import { errorResponse, jsonBody } from "@/lib/api";
import { listFinderPosts, parseFinderInput, parseFinderFilters } from "@/features/finder/posts";

// 공개 범위와 검색 조건을 적용해 분실물 목록을 불러온다.
// 조회 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export async function GET(request: Request) {
  const filters = parseFinderFilters(new URL(request.url).searchParams);
  // 확인할 조건: 검색 조건 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!filters) return errorResponse("INVALID_INPUT", "검색 조건을 확인하세요.", 400);
  const viewer = await getCurrentUser(await headers());
  // 선택 기준: (viewer의 이메일 인증 여부 있음 또는 true) 그리고 (viewer의 상태 = “인증된 학생”). 맞으면 viewer의 고유 번호를 사용하고, 아니면 undefined를 사용한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const posts = await listFinderPosts(getDb(), viewerId, filters.page, filters.kind, filters);
  return NextResponse.json({ posts: posts.slice(0, 20), page: filters.page, hasMore: posts.length > 20 });
}

// 인증된 사용자의 분실물 등록 요청을 처리한다.
// 등록 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  // request의 요청에 붙은 부가 정보에서 찾은 “content-type”이 비어 있으면 빈 글자를 대신 사용한다.
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: viewer 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 확인할 조건: (viewer의 이메일 인증 여부 없음 또는 false) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const body = await jsonBody(request);
  const input = parseFinderInput(body);
  // 요청 내용의 imageIds이 비어 있으면 빈 목록을 대신 사용한다.
  const images = imageIdsInput.safeParse(body?.imageIds ?? []);
  // 확인할 조건: (입력 내용 없음 또는 false) 또는 (이미지 목록의 입력 검사 통과 여부 없음 또는 false). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!input || !images.success) return errorResponse("INVALID_INPUT", "분실물 정보와 날짜를 확인하세요.", 400);
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  // 확인할 조건: 오류가 InvalidAttachments 종류. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  try { const post = await createFinderWithImages(getDb(), viewer.id, input, images.data); return NextResponse.json({ post }, { status: 201 }); } catch (error) { if (error instanceof InvalidAttachments) return errorResponse("INVALID_INPUT", "본인의 미첨부 이미지만 사용할 수 있습니다.", 400); throw error; }
}
