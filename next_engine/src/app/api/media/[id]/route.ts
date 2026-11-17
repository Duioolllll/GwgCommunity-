import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { getObjectStore } from "@/lib/storage/r2";
import { readVisibleImage } from "@/lib/storage/attachments";
export const runtime = "nodejs";
// 열람 권한에 맞는 이미지를 캐시 방지 헤더와 함께 반환한다.
// 조회 요청을 받아 이미지 처리를 하고 결과를 돌려준다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(request.headers);
  // 선택 기준: (viewer의 이메일 인증 여부 있음 또는 true) 그리고 (viewer의 상태 = “인증된 학생”). 맞으면 viewer의 고유 번호를 사용하고, 아니면 undefined를 사용한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const id = (await params).id;
  // 확인할 조건: 고유 번호을 검사한 결과의 입력 검사 통과 여부 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!z.string().uuid().safeParse(id).success) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
  // 아래 작업을 시도한다. 실패하면 아래에 있는 작업을 실행한다.
  try {
    const asset = await readVisibleImage(getDb(), getObjectStore(), id, viewerId, !!viewerId && viewer?.role === "admin");
    // 확인할 조건: 이미지 정보 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    if (!asset) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
    return new Response(Buffer.from(asset.data), { headers: { "Content-Type": asset.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { console.error("Media retrieval failed"); return errorResponse("STORAGE_ERROR", "이미지를 불러오지 못했습니다.", 500); }
}
