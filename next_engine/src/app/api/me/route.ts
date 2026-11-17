import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

// 현재 세션의 사용자 정보를 반환한다.
// 조회 요청을 받아 해당 기능 처리를 하고 결과를 돌려준다.
export async function GET() {
  const user = await getCurrentUser(await headers());
  // 로그인한 사용자를 찾지 못하면 로그인이 필요하다고 알리고 요청을 거절한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
