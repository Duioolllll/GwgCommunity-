/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { reviewMedia, uuidPattern } from "@/features/moderation/service";

// 관리자가 이미지 심사 결과를 변경한다.
// 기능 `PATCH`(request, { params }): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor(true);
  // 조건 `authError`: 참이면 `authError`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (authError) return authError;
  const { id } = await params;
  // 조건 `!uuidPattern.test(id)`: 참이면 `errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
  // 조건 `!isJson(request)`: 참이면 `errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  // 조건 `!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED")`: 참이면 `errorResponse("INVALID_INPUT", "검토 결과를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!body`: 거짓인 경우에만 오른쪽 `(body.decision !== "APPROVED" && body.decision !== "REJECTED")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `body.decision !== "APPROVED"`: 참인 경우에만 오른쪽 `body.decision !== "REJECTED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) return errorResponse("INVALID_INPUT", "검토 결과를 확인하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `failure(error)`를 반환한다.
  try {
    return NextResponse.json({ media: await reviewMedia(getDb(), viewer.id, id, body.decision) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
