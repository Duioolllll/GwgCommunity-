import { NextResponse } from "next/server";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { actor, failure, isJson } from "@/features/moderation/http";
import { createReport, parseReport } from "@/features/moderation/service";
export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
  const { viewer, error: authError } = await actor();
  if (authError) return authError;
  if (!isJson(request)) return errorResponse("INVALID_INPUT", "JSON 요청이 필요합니다.", 415);
  const input = parseReport(await jsonBody(request));
  if (!input) return errorResponse("INVALID_INPUT", "신고 대상을 확인하고 사유를 입력하세요.", 400);
  try { return NextResponse.json({ report: await createReport(getDb(), viewer.id, input) }, { status: 201, headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
