/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubRecruitments } from "@/lib/db/schema";

// 기능 `콜백`(v): `new Date(v.closesAt) > new Date(v.opensAt)` 평가 결과를 반환한다.
const input = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000), opensAt: z.string().datetime({ offset: true }), closesAt: z.string().datetime({ offset: true }), isOpen: z.boolean() }).refine(v => new Date(v.closesAt) > new Date(v.opensAt));
// 동아리 모집 공고 등록 요청을 처리한다.
// 기능 `POST`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id, true);`를 실행한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  const parsed = input.safeParse(await jsonBody(request));
  // 조건 `!parsed.success`: 참이면 `errorResponse("INVALID_INPUT", "제목, 내용과 모집 기간을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목, 내용과 모집 기간을 확인하세요.", 400);
  const [recruitment] = await getDb().insert(clubRecruitments).values({ ...parsed.data, clubId: auth.club.id, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).returning();
  return NextResponse.json({ recruitment }, { status: 201 });
}
// 동아리 모집 공고 수정 요청을 처리한다.
// 기능 `PATCH`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id, true);`를 실행한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  const body = await jsonBody(request);
  const parsed = input.safeParse(body);
  // 조건 `!parsed.success || !z.string().uuid().safeParse(body?.id).success`: 참이면 `errorResponse("INVALID_INPUT", "공고와 모집 기간을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!parsed.success`: 거짓인 경우에만 오른쪽 `!z.string().uuid().safeParse(body?.id).success`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!parsed.success || !z.string().uuid().safeParse(body?.id).success) return errorResponse("INVALID_INPUT", "공고와 모집 기간을 확인하세요.", 400);
  const [updated] = await getDb().update(clubRecruitments).set({ ...parsed.data, opensAt: new Date(parsed.data.opensAt), closesAt: new Date(parsed.data.closesAt) }).where(and(eq(clubRecruitments.id, body!.id as string), eq(clubRecruitments.clubId, auth.club.id))).returning({ id: clubRecruitments.id });
  // 선택 조건 `updated`: 참이면 `NextResponse.json({ ok: true })`, 거짓이면 `errorResponse("NOT_FOUND", "공고를 찾을 수 없습니다.", 404)`를 사용한다.
  return updated ? NextResponse.json({ ok: true }) : errorResponse("NOT_FOUND", "공고를 찾을 수 없습니다.", 404);
}
