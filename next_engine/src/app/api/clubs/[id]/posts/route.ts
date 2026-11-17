import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubPosts } from "@/lib/db/schema";
// 동아리 활동 게시물 등록 요청을 처리한다.
// 등록 요청을 받아 동아리 처리를 하고 결과를 돌려준다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 확인할 조건: auth의 오류 있음 또는 true. 해당하면 auth의 오류을 돌려준다.
  if (auth.error) return auth.error;
  const parsed = z.object({ title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  // 확인할 조건: parsed의 입력 검사 통과 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목과 내용을 확인하세요.", 400);
  const [post] = await getDb().insert(clubPosts).values({ ...parsed.data, clubId: auth.club.id, authorId: auth.viewer.id }).returning({ id: clubPosts.id });
  return NextResponse.json({ post }, { status: 201 });
}
