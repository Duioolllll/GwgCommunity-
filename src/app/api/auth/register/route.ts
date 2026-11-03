import { NextResponse } from "next/server";
import { createSession, db, passwordHash, redeemInvitation, randomUUID } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/api";

export async function POST(request: Request) {
  const body = await jsonBody(request);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!code || !email || !nickname || password.length < 8) return errorResponse("INVALID_INPUT", "모든 항목과 8자 이상 비밀번호가 필요합니다.", 400);
  if (db.users.some((user) => user.email === email)) return errorResponse("EMAIL_EXISTS", "이미 가입된 이메일입니다.", 409);
  const invitation = redeemInvitation(code);
  if (!invitation) return errorResponse("INVALID_INVITATION", "유효하지 않거나 만료된 초대 코드입니다.", 400);
  const user = { id: randomUUID(), email, nickname, passwordHash: passwordHash(password), role: "student" as const, status: "ACTIVE_STUDENT" as const };
  invitation.usedAt = new Date().toISOString();
  invitation.redeemedBy = user.id;
  db.users.push(user);
  const token = createSession(user.id);
  const response = NextResponse.json({ user: { id: user.id, email, nickname, role: user.role } }, { status: 201 });
  response.cookies.set("gwg_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}
