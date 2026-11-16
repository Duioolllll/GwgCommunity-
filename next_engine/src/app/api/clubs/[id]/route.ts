/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getPublicClub } from "@/app/clubs/data";

// 공개 동아리 상세 정보를 조회한다.
// 기능 `GET`(_, { params }): 먼저 `const club = await getPublicClub((await params).id);`를 실행한다.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const club = await getPublicClub((await params).id);
  // 선택 조건 `club`: 참이면 `NextResponse.json({ club })`, 거짓이면 `errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404)`를 사용한다.
  return club ? NextResponse.json({ club }) : errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404);
}

// 동아리 정보 수정 요청을 처리한다.
// 기능 `PATCH`(request, { params }): 먼저 `const { authorizeClub } = await import("@/app/clubs/authorization");`를 실행한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorizeClub } = await import("@/app/clubs/authorization");
  const { jsonBody } = await import("@/lib/api");
  const { getDb } = await import("@/lib/db");
  const { clubs } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { z } = await import("zod");
  const auth = await authorizeClub((await params).id, true);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  const data = z.object({ name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(50), introduction: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  // 조건 `!data.success`: 참이면 `errorResponse("INVALID_INPUT", "동아리 정보를 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!data.success) return errorResponse("INVALID_INPUT", "동아리 정보를 확인하세요.", 400);
  await getDb().update(clubs).set(data.data).where(eq(clubs.id, auth.club.id));
  return NextResponse.json({ ok: true });
}
