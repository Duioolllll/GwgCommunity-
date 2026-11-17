import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

// 분실·습득 게시물의 일치 후보를 불러온다.
// 조회 요청을 받아 분실물 처리를 하고 결과를 돌려준다.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(await headers());
  // 확인할 조건: viewer 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 확인할 조건: (viewer의 이메일 인증 여부 없음 또는 false) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 확인할 조건: 고유 번호의 형식이 맞음 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    return NextResponse.json({ matches: await getFinderMatches(getDb(), id, viewer.id) });
  } catch (error) {
    // 확인할 조건: 오류가 FinderMatchError 종류. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    // 선택 기준: 오류의 종류 = “NOT_FOUND”. 맞으면 “게시물을 찾을 수 없습니다.” 값을 사용하고, 아니면 “접근 권한이 없습니다.” 값을 사용한다.
    // 선택 기준: 오류의 종류 = “NOT_FOUND”. 맞으면 404를 사용하고, 아니면 403를 사용한다.
    if (error instanceof FinderMatchError) return errorResponse(error.code, error.code === "NOT_FOUND" ? "게시물을 찾을 수 없습니다." : "접근 권한이 없습니다.", error.code === "NOT_FOUND" ? 404 : 403);
    throw error;
  }
}
