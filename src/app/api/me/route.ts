import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/store";

export async function GET() {
  const token = (await cookies()).get("gwg_session")?.value;
  const user = getUser(token);
  return NextResponse.json({ user: user ? { id: user.id, email: user.email, nickname: user.nickname, role: user.role } : null });
}
