import { NextResponse } from "next/server";
import { createSession, db, getUser, passwordHash } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = db.users.find((item) => item.email === email && item.passwordHash === passwordHash(password));
  if (!user || user.status !== "ACTIVE_STUDENT") return errorResponse("INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인하세요.", 401);
  const token = createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
  response.cookies.set("gwg_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}

export async function DELETE(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)gwg_session=([^;]+)/)?.[1];
  const user = getUser(token);
  if (!user) return errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("gwg_session");
  return response;
}
