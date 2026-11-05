import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { ModerationError } from "./service";
export async function actor(admin = false) {
  const current = await getCurrentUser(await headers());
  if (!current) return { error: errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401), viewer: null };
  if (!current.emailVerified || current.status !== "ACTIVE_STUDENT" || (admin && current.role !== "admin")) return { error: errorResponse("FORBIDDEN", "접근 권한이 없습니다.", 403), viewer: null };
  return { viewer: current, error: null };
}
export function failure(error: unknown) {
  if (!(error instanceof ModerationError)) throw error;
  const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
  return errorResponse(error.code, status === 409 ? "이미 처리되었거나 대상이 변경되었습니다." : status === 404 ? "대상을 찾을 수 없습니다." : "접근 권한이 없습니다.", status);
}
export function isJson(request: Request) { return /^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""); }
