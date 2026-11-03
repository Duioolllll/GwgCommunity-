import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, getUser, randomUUID, type FinderKind } from "@/lib/store";
import { errorResponse, jsonBody } from "@/lib/api";

export async function GET() {
  return NextResponse.json({ posts: db.finder });
}

export async function POST(request: Request) {
  const user = getUser((await cookies()).get("gwg_session")?.value);
  if (!user) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  const body = await jsonBody(request);
  const kind: FinderKind | null = body?.kind === "lost" || body?.kind === "found" ? body.kind : null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const color = typeof body?.color === "string" ? body.color.trim() : "";
  const generalLocation = typeof body?.generalLocation === "string" ? body.generalLocation.trim() : "";
  const occurredAt = typeof body?.occurredAt === "string" ? body.occurredAt : "";
  if (!kind || !title || !category || !color || !generalLocation || !occurredAt) return errorResponse("INVALID_INPUT", "분실물 정보를 모두 입력하세요.", 400);
  const post = { id: randomUUID(), authorId: user.id, kind, title, category, color, generalLocation, occurredAt, status: "ACTIVE" as const };
  db.finder.unshift(post);
  return NextResponse.json({ post }, { status: 201 });
}
