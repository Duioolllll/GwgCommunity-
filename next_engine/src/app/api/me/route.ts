import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser(await headers());
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
