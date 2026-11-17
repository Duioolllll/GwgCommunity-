import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubRecruitments } from "@/lib/db/schema";

// 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
const input = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000), opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }), isOpen: z.boolean() }).refine(v => new Date(v.closesAt) > new Date(v.opensAt));
// 동아리 모집 공고 등록 요청을 처리한다.
// 등록 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  const parsed = input.safeParse(await jsonBody(request));
  // 확인할 조건: parsed의 입력 검사 통과 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목, 내용과 모집 기간을 확인하세요.", 400);
  const [recruitment] = await getDb().insert(clubRecruitments).values({ ...parsed.data, clubId: auth.club.id, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).returning();
  return NextResponse.json({ recruitment }, { status: 201 });
}
// 동아리 모집 공고 수정 요청을 처리한다.
// 수정 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  const parsed = input.safeParse(body);
  // 확인할 조건: (parsed의 입력 검사 통과 여부 없음 또는 false) 또는 (요청 내용의 고유 번호을 검사한 결과의 입력 검사 통과 여부 없음 또는 false). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!parsed.success || !z.string().uuid().safeParse(body?.id).success) return errorResponse("INVALID_INPUT", "공고와 모집 기간을 확인하세요.", 400);
  const [updated] = await getDb().update(clubRecruitments).set({ ...parsed.data, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).where(and(eq(clubRecruitments.id, body!.id as string), eq(clubRecruitments.clubId, auth.club.id))).returning({ id: clubRecruitments.id });
  // 선택 기준: updated 있음 또는 true. 맞으면 서버와 주고받는 자료를 사용하고, 아니면 errorResponse 처리 결과를 사용한다.
  return updated ? NextResponse.json({ ok: true }) : errorResponse("NOT_FOUND", "공고를 찾을 수 없습니다.", 404);
}
