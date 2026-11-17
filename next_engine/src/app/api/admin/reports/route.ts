import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { actor, failure } from "@/features/moderation/http";
import { listReports } from "@/features/moderation/service";
// 관리자의 신고 목록을 불러온다.
// 조회 요청을 받아 신고 처리를 하고 결과를 돌려준다.
export async function GET() {
  const { viewer, error: authError } = await actor(true);
  // 확인할 조건: authError 있음 또는 true. 해당하면 authError을 돌려준다.
  if (authError) return authError;
  // 아래 작업을 시도한다. 실패하면 요청을 처리할 수 없다는 안내를 돌려준다.
  try { return NextResponse.json({ reports: await listReports(getDb(), viewer.id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
