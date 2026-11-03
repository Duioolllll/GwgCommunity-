import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { updateReport, uuidPattern, type ReportState } from "@/features/moderation/service";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor(true);
  if (authError) return authError;
  const { id } = await params;
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "신고를 찾을 수 없습니다.", 404);
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const body = await jsonBody(request);
  if (!body || !((body.from === "OPEN" && (body.to === "REVIEWED" || body.to === "RESOLVED")) || (body.from === "REVIEWED" && body.to === "RESOLVED"))) return errorResponse("INVALID_INPUT", "처리 상태를 확인하세요.", 400);
  try { return NextResponse.json({ report: await updateReport(getDb(), viewer.id, id, body.from as ReportState, body.to as ReportState) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
