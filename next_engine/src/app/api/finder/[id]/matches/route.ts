/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

// 분실·습득 게시물의 일치 후보를 조회한다.
// 기능 `GET`(_request, { params }): 먼저 `const viewer = await getCurrentUser(await headers());`를 실행한다.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(await headers());
  // 조건 `!viewer`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 조건 `!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)`: 참이면 `errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof FinderMatchError` 조건을 추가로 검사한다.
  try {
    return NextResponse.json({ matches: await getFinderMatches(getDb(), id, viewer.id) });
  } catch (error) {
    // 조건 `error instanceof FinderMatchError`: 참이면 `errorResponse(error.code, error.code === "NOT_FOUND" ? "게시물을 찾을 수 없습니다." : "접근 권한이 없습니다.", error.code === "NOT_FOUND" ? 404 : 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 선택 조건 `error.code === "NOT_FOUND"`: 참이면 `"게시물을 찾을 수 없습니다."`, 거짓이면 `"접근 권한이 없습니다."`를 사용한다.
    // 선택 조건 `error.code === "NOT_FOUND"`: 참이면 `404`, 거짓이면 `403`를 사용한다.
    if (error instanceof FinderMatchError) return errorResponse(error.code, error.code === "NOT_FOUND" ? "게시물을 찾을 수 없습니다." : "접근 권한이 없습니다.", error.code === "NOT_FOUND" ? 404 : 403);
    throw error;
  }
}
