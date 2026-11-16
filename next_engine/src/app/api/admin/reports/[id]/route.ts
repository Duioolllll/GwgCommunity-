/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { updateReport, uuidPattern, type ReportState } from "@/features/moderation/service";
// 관리자가 신고 처리 상태를 변경한다.
// 기능 `PATCH`(request, { params }): `!hasTrustedOrigin(request)` 조건을 추가로 검사한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor(true);
  // 조건 `authError`: 참이면 `authError`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (authError) return authError;
  const { id } = await params;
  // 조건 `!uuidPattern.test(id)`: 참이면 `errorResponse("NOT_FOUND", "신고를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "신고를 찾을 수 없습니다.", 404);
  // 조건 `!isJson(request)`: 참이면 `errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  // 조건 `!body || !((body.from === "OPEN" && (body.to === "REVIEWED" || body.to === "RESOLVED")) || (body.from === "REVIEWED" && body.to === "RESOLVED"))`: 참이면 `errorResponse("INVALID_INPUT", "처리 상태를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!body`: 거짓인 경우에만 오른쪽 `!((body.from === "OPEN" && (body.to === "REVIEWED" || body.to === "RESOLVED")) || (body.from === "REVIEWED" && body.to === "RESOLVED"))`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `(body.from === "OPEN" && (body.to === "REVIEWED" || body.to === "RESOLVED"))`: 거짓인 경우에만 오른쪽 `(body.from === "REVIEWED" && body.to === "RESOLVED")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `body.from === "OPEN"`: 참인 경우에만 오른쪽 `(body.to === "REVIEWED" || body.to === "RESOLVED")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `body.to === "REVIEWED"`: 거짓인 경우에만 오른쪽 `body.to === "RESOLVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `body.from === "REVIEWED"`: 참인 경우에만 오른쪽 `body.to === "RESOLVED"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!body || !((body.from === "OPEN" && (body.to === "REVIEWED" || body.to === "RESOLVED")) || (body.from === "REVIEWED" && body.to === "RESOLVED"))) return errorResponse("INVALID_INPUT", "처리 상태를 확인하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `failure(error)`를 반환한다.
  try { return NextResponse.json({ report: await updateReport(getDb(), viewer.id, id, body.from as ReportState, body.to as ReportState) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
