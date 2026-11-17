import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/api";
import { InvalidImageError } from "@/lib/storage/image";
import { validOrigin, readBoundedMultipart } from "@/lib/storage/request";
import { getObjectStore } from "@/lib/storage/r2";
import { saveImage } from "@/lib/storage/service";
export const runtime = "nodejs";
// 이미지 업로드 요청을 처리한다.
// 등록 요청을 받아 이미지 처리를 하고 결과를 돌려준다.
export async function POST(request: Request) {
  // 확인할 조건: 허용된 사이트에서 보낸 요청임 조건을 만족하지 않음. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!validOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인하세요.", 403);
  const viewer = await getCurrentUser(request.headers);
  // 확인할 조건: viewer 없음 또는 false. 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 확인할 조건: (viewer의 이메일 인증 여부 없음 또는 false) 또는 (viewer의 상태 ≠ “인증된 학생”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  // 아래 작업을 시도한다. 실패하면 추가 조건을 한 번 더 확인한다.
  try {
    const form = await readBoundedMultipart(request);
    const files = form.getAll("file");
    // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
    if (files.length !== 1 || !(files[0] instanceof File) || [...form.keys()].some(k => k !== "file")) return errorResponse("INVALID_INPUT", "이미지 파일 하나를 선택하세요.", 400);
    const file = files[0];
    const asset = await saveImage(getDb(), getObjectStore(), viewer.id, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 이미 준비한 이미지 오류 안내라면 그대로 전달한다. 다른 읽기 오류는 파일을 읽을 수 없다는 안내로 바꾼다.
    if (error instanceof InvalidImageError) return errorResponse("INVALID_INPUT", error.message, 400);
    // 확인할 조건: (오류가 Error 종류) 그리고 (오류의 안내 문장 = “TOO_LARGE”). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    if (error instanceof Error && error.message === "TOO_LARGE") return errorResponse("TOO_LARGE", "이미지 크기는 5MB 이하여야 합니다.", 413);
    // 확인할 조건: (오류가 TypeError 종류) 또는 ((오류가 Error 종류) 그리고 (오류의 안내 문장 = “INVALID_MULTIPART”)). 해당하면 요청을 처리할 수 없다는 안내를 돌려준다.
    if (error instanceof TypeError || (error instanceof Error && error.message === "INVALID_MULTIPART")) return errorResponse("INVALID_INPUT", "파일 업로드 요청을 확인하세요.", 400);
    console.error("Media upload failed");
    return errorResponse("STORAGE_ERROR", "이미지를 저장하지 못했습니다.", 500);
  }
}
