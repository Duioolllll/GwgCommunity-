import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, getUser, randomUUID } from "@/lib/store";
import { errorResponse } from "@/lib/api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  const { id } = await params;
  const club = db.clubs.find((item) => item.id === id);
  if (!club) return errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404);
  if (!club.recruiting) return errorResponse("CLOSED", "현재 모집 기간이 아닙니다.", 409);
  if (db.applications.some((item) => item.clubId === club.id && item.applicantId === user.id)) return errorResponse("DUPLICATE", "이미 지원한 동아리입니다.", 409);
  db.applications.push({ id: randomUUID(), clubId: club.id, applicantId: user.id, createdAt: new Date().toISOString(), status: "SUBMITTED" });
  return NextResponse.json({ ok: true, message: `${club.name} 지원이 접수되었습니다.` }, { status: 201 });
}
