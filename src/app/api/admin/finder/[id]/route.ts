import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { reviewFinder, uuidPattern } from "@/features/moderation/service";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor(true);
  if (authError) return authError;
  const { id } = await params;
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  if (!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) return errorResponse("INVALID_INPUT", "검토 결과를 확인하세요.", 400);
  try { return NextResponse.json({ post: await reviewFinder(getDb(), viewer.id, id, body.decision) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
