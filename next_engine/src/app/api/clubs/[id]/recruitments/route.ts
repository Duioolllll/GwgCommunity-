import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubRecruitments } from "@/lib/db/schema";

const input = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000), opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }), isOpen: z.boolean() }).refine(v => new Date(v.closesAt) > new Date(v.opensAt));
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  if (auth.error) return auth.error;
  const parsed = input.safeParse(await jsonBody(request));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목, 내용과 모집 기간을 확인하세요.", 400);
  const [recruitment] = await getDb().insert(clubRecruitments).values({ ...parsed.data, clubId: auth.club.id, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).returning();
  return NextResponse.json({ recruitment }, { status: 201 });
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  const parsed = input.safeParse(body);
  if (!parsed.success || !z.string().uuid().safeParse(body?.id).success) return errorResponse("INVALID_INPUT", "공고와 모집 기간을 확인하세요.", 400);
  const [updated] = await getDb().update(clubRecruitments).set({ ...parsed.data, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).where(and(eq(clubRecruitments.id, body!.id as string), eq(clubRecruitments.clubId, auth.club.id))).returning({ id: clubRecruitments.id });
  return updated ? NextResponse.json({ ok: true }) : errorResponse("NOT_FOUND", "공고를 찾을 수 없습니다.", 404);
}
