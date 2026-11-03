import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { getObjectStore } from "@/lib/storage/r2";
import { readVisibleImage } from "@/lib/storage/attachments";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(request.headers);
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const id = (await params).id;
  if (!z.string().uuid().safeParse(id).success) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
  try {
    const asset = await readVisibleImage(getDb(), getObjectStore(), id, viewerId);
    if (!asset) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
    return new Response(Buffer.from(asset.data), { headers: { "Content-Type": asset.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { console.error("Media retrieval failed"); return errorResponse("STORAGE_ERROR", "이미지를 불러오지 못했습니다.", 500); }
}
