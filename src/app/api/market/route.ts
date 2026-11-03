import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, getUser, randomUUID } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/api";

export async function GET() {
  return NextResponse.json({ posts: db.market });
}

export async function POST(request: Request) {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  const body = await jsonBody(request);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const price = typeof body?.price === "number" ? body.price : Number(body?.price);
  if (!title || !description || !category || !Number.isInteger(price) || price < 0) return errorResponse("INVALID_INPUT", "상품 정보를 확인하세요.", 400);
  const post = { id: randomUUID(), authorId: user.id, title, description, price, category, status: "AVAILABLE" as const, createdAt: new Date().toISOString() };
  db.market.unshift(post);
  return NextResponse.json({ post }, { status: 201 });
}
