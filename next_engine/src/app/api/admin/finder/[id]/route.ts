import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { reviewFinder, uuidPattern } from "@/features/moderation/service";
// 관리자의 분실물 공개 심사 요청을 처리한다.
// 수정 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor(true);
  // 확인할 조건: authError 있음 또는 true. 해당하면 authError을 돌려준다.
  if (authError) return authError;
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  // 확인할 조건: 요청 본문이 JSON 형식임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  if (!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED") || typeof body.reviewToken !== "string" || !/^[a-f0-9]{64}$/.test(body.reviewToken)) return errorResponse("INVALID_INPUT", "검토 목록을 새로 불러온 뒤 다시 시도하세요.", 400);
  // 아래 작업을 시도한다. 실패하면 요청을 처리할 수 없다는 안내를 돌려준다.
  try { return NextResponse.json({ post: await reviewFinder(getDb(), viewer.id, id, body.decision, body.reviewToken) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
