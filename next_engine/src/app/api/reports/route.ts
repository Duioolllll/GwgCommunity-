/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { createReport, parseReport } from "@/features/moderation/service";
// 게시물 신고 요청을 처리한다.
// 기능 `POST`(request): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor();
  // 조건 `authError`: 참이면 `authError`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (authError) return authError;
  // 조건 `!isJson(request)`: 참이면 `errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const input = parseReport(await jsonBody(request));
  // 조건 `!input`: 참이면 `errorResponse("INVALID_INPUT", "신고 대상을 확인하고 사유를 입력하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!input) return errorResponse("INVALID_INPUT", "신고 대상을 확인하고 사유를 입력하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `failure(error)`를 반환한다.
  try { return NextResponse.json({ report: await createReport(getDb(), viewer.id, input) }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
