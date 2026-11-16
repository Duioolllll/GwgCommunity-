/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { marketId } from "@/features/market/data";
import { ReservationError, transitionReservation } from "@/features/market/reservations";

// 예약 취소 또는 거래 완료 요청을 처리한다.
// 기능 `PATCH`(request, { params }): 먼저 `const user = await getCurrentUser(await headers());`를 실행한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(await headers());
  // 조건 `!user`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!user.emailVerified || user.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!user.emailVerified`: 거짓인 경우에만 오른쪽 `user.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 조건 `!marketId.safeParse(id).success`: 참이면 `errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const body = await jsonBody(request);
  // 조건 `body?.action !== "cancel" && body?.action !== "complete"`: 참이면 `errorResponse("INVALID_INPUT", "거래 상태를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `body?.action !== "cancel"`: 참인 경우에만 오른쪽 `body?.action !== "complete"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (body?.action !== "cancel" && body?.action !== "complete") return errorResponse("INVALID_INPUT", "거래 상태를 확인하세요.", 400);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof ReservationError` 조건을 추가로 검사한다.
  try {
    await transitionReservation(getDb(), id, user.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 조건 `error instanceof ReservationError`: 참이면 `errorResponse(error.code, error.code === "FORBIDDEN" ? "권한이 없습니다." : "변경할 수 없는 거래입니다.", error.code === "FORBIDDEN" ? 403 : 409)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 선택 조건 `error.code === "FORBIDDEN"`: 참이면 `"권한이 없습니다."`, 거짓이면 `"변경할 수 없는 거래입니다."`를 사용한다.
    // 선택 조건 `error.code === "FORBIDDEN"`: 참이면 `403`, 거짓이면 `409`를 사용한다.
    if (error instanceof ReservationError) return errorResponse(error.code, error.code === "FORBIDDEN" ? "권한이 없습니다." : "변경할 수 없는 거래입니다.", error.code === "FORBIDDEN" ? 403 : 409);
    throw error;
  }
}
