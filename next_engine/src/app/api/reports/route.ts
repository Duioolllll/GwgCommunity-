import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { createReport, parseReport } from "@/features/moderation/service";
// 게시물 신고 요청을 처리한다.
// 등록 요청을 받아 신고 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor();
  // 확인할 조건: authError 있음 또는 true. 해당하면 authError을 돌려준다.
  if (authError) return authError;
  // 확인할 조건: 요청 본문이 JSON 형식임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const input = parseReport(await jsonBody(request));
  // 확인할 조건: 입력 내용 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!input) return errorResponse("INVALID_INPUT", "신고 대상을 확인하고 사유를 입력하세요.", 400);
  // 아래 작업을 시도한다. 실패하면 요청을 처리할 수 없다는 안내를 돌려준다.
  try { return NextResponse.json({ report: await createReport(getDb(), viewer.id, input) }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
