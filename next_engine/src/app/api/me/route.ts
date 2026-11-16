/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

// 현재 세션의 사용자 정보를 반환한다.
// 기능 `GET`(): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export async function GET() {
  const user = await getCurrentUser(await headers());
  // 조건 `!user`: 참이면 `errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
