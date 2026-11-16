/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubPosts } from "@/lib/db/schema";
// 동아리 활동 게시물 등록 요청을 처리한다.
// 기능 `POST`(request, { params }): 먼저 `const auth = await authorizeClub((await params).id, true);`를 실행한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  // 조건 `auth.error`: 참이면 `auth.error`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (auth.error) return auth.error;
  const parsed = z.object({ title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  // 조건 `!parsed.success`: 참이면 `errorResponse("INVALID_INPUT", "제목과 내용을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목과 내용을 확인하세요.", 400);
  const [post] = await getDb().insert(clubPosts).values({ ...parsed.data, clubId: auth.club.id, authorId: auth.viewer.id }).returning({ id: clubPosts.id });
  return NextResponse.json({ post }, { status: 201 });
}
