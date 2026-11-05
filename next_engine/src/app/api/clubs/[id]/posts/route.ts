import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeClub } from "@/app/clubs/authorization";
import { errorResponse, jsonBody } from "@/lib/api";
import { getDb } from "@/lib/db";
import { clubPosts } from "@/lib/db/schema";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeClub((await params).id, true);
  if (auth.error) return auth.error;
  const parsed = z.object({ title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  if (!parsed.success) return errorResponse("INVALID_INPUT", "제목과 내용을 확인하세요.", 400);
  const [post] = await getDb().insert(clubPosts).values({ ...parsed.data, clubId: auth.club.id, authorId: auth.viewer.id }).returning({ id: clubPosts.id });
  return NextResponse.json({ post }, { status: 201 });
}
