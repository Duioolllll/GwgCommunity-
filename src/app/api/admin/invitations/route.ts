import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createInvitation, db, getUser } from "@/lib/store";
import { errorResponse } from "@/lib/api";

export async function POST() {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  if (user.role !== "admin") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  return NextResponse.json({ code: createInvitation(), expiresInDays: 7 }, { status: 201 });
}

export async function GET() {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user || user.role !== "admin") return errorResponse("FORBIDDEN", "관리자 권한이 필요합니다.", 403);
  return NextResponse.json({ invitations: db.invitations.map(({ codeHash, ...item }) => ({ ...item, codeHash: `${codeHash.slice(0, 8)}…` })) });
}
