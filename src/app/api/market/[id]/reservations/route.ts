import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, getUser } from "@/lib/store";
import { errorResponse } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  const { id } = await params;
  const post = db.market.find((item) => item.id === id);
  if (!post) return errorResponse("NOT_FOUND", "상품을 찾을 수 없습니다.", 404);
  if (post.authorId === user.id) return errorResponse("INVALID_ACTION", "본인 상품에는 예약할 수 없습니다.", 400);
  if (post.status !== "AVAILABLE") return errorResponse("CONFLICT", "이미 예약되었거나 거래 완료된 상품입니다.", 409);
  post.status = "RESERVED";
  return NextResponse.json({ post });
}
