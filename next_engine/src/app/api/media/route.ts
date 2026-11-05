import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { InvalidImageError } from "@/lib/storage/image";
import { validOrigin, readBoundedMultipart } from "@/lib/storage/request";
import { getObjectStore } from "@/lib/storage/r2";
import { saveImage } from "@/lib/storage/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!validOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인하세요.", 403);
  const viewer = await getCurrentUser(request.headers);
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  try {
    const form = await readBoundedMultipart(request);
    const files = form.getAll("file");
    if (files.length !== 1 || !(files[0] instanceof File) || [...form.keys()].some(k => k !== "file")) return errorResponse("INVALID_INPUT", "이미지 파일 하나를 선택하세요.", 400);
    const file = files[0];
    const asset = await saveImage(getDb(), getObjectStore(), viewer.id, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InvalidImageError) return errorResponse("INVALID_INPUT", error.message, 400);
    if (error instanceof Error && error.message === "TOO_LARGE") return errorResponse("TOO_LARGE", "이미지 크기는 5MB 이하여야 합니다.", 413);
    if (error instanceof TypeError || (error instanceof Error && error.message === "INVALID_MULTIPART")) return errorResponse("INVALID_INPUT", "파일 업로드 요청을 확인하세요.", 400);
    console.error("Media upload failed");
    return errorResponse("STORAGE_ERROR", "이미지를 저장하지 못했습니다.", 500);
  }
}
