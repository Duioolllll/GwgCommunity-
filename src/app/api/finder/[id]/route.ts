import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse, jsonBody } from "@/lib/api";
import { uuidPattern } from "@/features/moderation/service";
import { parseFinderInput } from "@/features/finder/posts";
import { FinderMutationError, mutateFinderPost } from "@/features/finder/service";

type Params = { params: Promise<{ id: string }> };
async function handle(request: Request, { params }: Params, method: "PATCH" | "DELETE") {
  const viewer = await getCurrentUser(await headers());
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  const { id } = await params;
  if (!uuidPattern.test(id)) return errorResponse("NOT_FOUND", "게시물을 찾을 수 없습니다.", 404);
  let action: Parameters<typeof mutateFinderPost>[3] = { type: "delete" };
  if (method === "PATCH") {
    const body = await jsonBody(request);
    if (body?.action === "close" && Object.keys(body).length === 1) action = { type: "close" };
    else {
      const input = parseFinderInput(body);
      // Attachments cannot be changed through this endpoint.
      if (!input || !body || Object.keys(body).some(key => !["kind", "title", "category", "color", "generalLocation", "occurredAt"].includes(key))) return errorResponse("INVALID_INPUT", "분실물 정보를 확인하세요.", 400);
      action = { type: "edit", input };
    }
  }
  try {
    await mutateFinderPost(getDb(), id, viewer.id, action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FinderMutationError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
      return errorResponse(error.code, status === 404 ? "게시물을 찾을 수 없습니다." : status === 403 ? "작성자만 변경할 수 있습니다." : "종료된 게시물은 변경할 수 없습니다.", status);
    }
    throw error;
  }
}
export function PATCH(request: Request, params: Params) { return handle(request, params, "PATCH"); }
export function DELETE(request: Request, params: Params) { return handle(request, params, "DELETE"); }
