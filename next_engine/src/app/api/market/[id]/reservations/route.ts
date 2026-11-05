import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getDb } from "@/lib/db";
import { marketId } from "@/features/market/data";
import { reserveMarketPost, ReservationError } from "@/features/market/reservations";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(await headers());
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!user.emailVerified || user.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  if (!marketId.safeParse(id).success) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  try {
    const reservation = await reserveMarketPost(getDb(), id, user.id);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    if (error instanceof ReservationError) return errorResponse(error.code, error.code === "FORBIDDEN" ? "학생 인증이 필요합니다." : "예약할 수 없는 상품입니다.", error.code === "FORBIDDEN" ? 403 : 409);
    throw error;
  }
}
