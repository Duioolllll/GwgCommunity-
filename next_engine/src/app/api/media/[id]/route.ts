/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { getObjectStore } from "@/lib/storage/r2";
import { readVisibleImage } from "@/lib/storage/attachments";
export const runtime = "nodejs";
// 열람 권한에 맞는 이미지를 캐시 방지 헤더와 함께 반환한다.
// 기능 `GET`(request, { params }): 먼저 `const viewer = await getCurrentUser(request.headers);`를 실행한다.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser(request.headers);
  // 선택 조건 `viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT"`: 참이면 `viewer.id`, 거짓이면 `undefined`를 사용한다.
  // 단락 분기 `viewer?.emailVerified`: 참인 경우에만 오른쪽 `viewer.status === "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  const viewerId = viewer?.emailVerified && viewer.status === "ACTIVE_STUDENT" ? viewer.id : undefined;
  const id = (await params).id;
  // 조건 `!z.string().uuid().safeParse(id).success`: 참이면 `errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!z.string().uuid().safeParse(id).success) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
  // 예외 처리: 본문 실행 중 예외가 발생하면 먼저 `console.error("Media retrieval failed");`를 실행한다.
  try {
    // 단락 분기 `!!viewerId`: 참인 경우에만 오른쪽 `viewer?.role === "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    const asset = await readVisibleImage(getDb(), getObjectStore(), id, viewerId, !!viewerId && viewer?.role === "admin");
    // 조건 `!asset`: 참이면 `errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (!asset) return errorResponse("NOT_FOUND", "이미지를 찾을 수 없습니다.", 404);
    return new Response(Buffer.from(asset.data), { headers: { "Content-Type": asset.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { console.error("Media retrieval failed"); return errorResponse("STORAGE_ERROR", "이미지를 불러오지 못했습니다.", 500); }
}
