import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getPublicClub } from "@/app/clubs/data";

// 공개 동아리 상세 정보를 불러온다.
// 조회 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const club = await getPublicClub((await params).id);
  // 선택 기준: 동아리 있음 또는 true. 맞으면 서버와 주고받는 자료를 사용하고, 아니면 errorResponse 처리 결과를 사용한다.
  return club ? NextResponse.json({ club }) : errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404);
}

// 동아리 정보 수정 요청을 처리한다.
// 수정 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorizeClub } = await import("@/app/clubs/authorization");
  const { jsonBody } = await import("@/lib/api");
  const { getDb } = await import("@/lib/db");
  const { clubs } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { z } = await import("zod");
  const auth = await authorizeClub((await params).id, true);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  const data = z.object({ name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(50), introduction: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  // 확인할 조건: 저장하거나 받은 자료의 입력 검사 통과 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!data.success) return errorResponse("INVALID_INPUT", "동아리 정보를 확인하세요.", 400);
  await getDb().update(clubs).set(data.data).where(eq(clubs.id, auth.club.id));
  return NextResponse.json({ ok: true });
}
