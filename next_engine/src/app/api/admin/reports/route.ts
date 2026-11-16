/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { actor, failure } from "@/features/moderation/http";
import { listReports } from "@/features/moderation/service";
// 관리자의 신고 목록을 조회한다.
// 기능 `GET`(): 먼저 `const { viewer, error: authError } = await actor(true);`를 실행한다.
export async function GET() {
  const { viewer, error: authError } = await actor(true);
  // 조건 `authError`: 참이면 `authError`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (authError) return authError;
  // 예외 처리: 본문 실행 중 예외가 발생하면 `failure(error)`를 반환한다.
  try { return NextResponse.json({ reports: await listReports(getDb(), viewer.id) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
