import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getPublicClub } from "@/app/clubs/data";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const club = await getPublicClub((await params).id);
  return club ? NextResponse.json({ club }) : errorResponse("NOT_FOUND", "동아리를 찾을 수 없습니다.", 404);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorizeClub } = await import("@/app/clubs/authorization");
  const { jsonBody } = await import("@/lib/api");
  const { getDb } = await import("@/lib/db");
  const { clubs } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { z } = await import("zod");
  const auth = await authorizeClub((await params).id, true);
  if (auth.error) return auth.error;
  const data = z.object({ name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(50), introduction: z.string().trim().min(1).max(5000), isPublic: z.boolean() }).safeParse(await jsonBody(request));
  if (!data.success) return errorResponse("INVALID_INPUT", "동아리 정보를 확인하세요.", 400);
  await getDb().update(clubs).set(data.data).where(eq(clubs.id, auth.club.id));
  return NextResponse.json({ ok: true });
}
