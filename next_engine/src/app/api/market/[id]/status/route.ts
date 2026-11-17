import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { marketId } from "@/features/market/data";
import { ReservationError, transitionReservation } from "@/features/market/reservations";

// 예약 취소 또는 거래 완료 요청을 처리한다.
// 수정 요청을 받아 중고거래 처리를 하고 결과를 돌려준다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(await headers());
  // 로그인한 사용자를 찾지 못하면 로그인이 필요하다고 알리고 요청을 거절한다.
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 이메일 인증과 학생 인증을 모두 마친 사용자만 이 기능을 이용할 수 있다.
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  // 확인할 조건: 고유 번호을 검사한 결과의 입력 검사 통과 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  const body = await jsonBody(request);
  // 확인할 조건: (요청 내용의 선택한 작업 ≠ “취소”) 그리고 (요청 내용의 선택한 작업 ≠ “완료”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (body?.action !== "cancel" && body?.action !== "complete") return errorResponse("INVALID_INPUT", "거래 상태를 확인하세요.", 400);
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    await transitionReservation(getDb(), id, user.id, body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 확인할 조건: 오류가 ReservationError 종류. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    // 선택 기준: 오류의 종류 = “권한 없음”. 맞으면 “권한이 없습니다.” 값을 사용하고, 아니면 “변경할 수 없는 거래입니다.” 값을 사용한다.
    // 선택 기준: 오류의 종류 = “권한 없음”. 맞으면 403를 사용하고, 아니면 409를 사용한다.
    if (error instanceof ReservationError) return errorResponse(error.code, error.code === "FORBIDDEN" ? "권한이 없습니다." : "변경할 수 없는 거래입니다.", error.code === "FORBIDDEN" ? 403 : 409);
    throw error;
  }
}
