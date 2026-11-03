import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { FinderMatchError, getFinderMatches } from "@/features/finder/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(await headers());
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  try {
    return NextResponse.json({ matches: await getFinderMatches(getDb(), id, viewer.id) });
  } catch (error) {
    if (error instanceof FinderMatchError) return errorResponse(error.code, error.code === "NOT_FOUND" ? "게시물을 찾을 수 없습니다." : "접근 권한이 없습니다.", error.code === "NOT_FOUND" ? 404 : 403);
    throw error;
  }
}
