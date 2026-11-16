/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
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
// 기능 `POST`(request): `!validOrigin(request)` 조건을 추가로 검사한다.
export async function POST(request: Request) {
  // 조건 `!validOrigin(request)`: 참이면 `errorResponse("FORBIDDEN", "요청 출처를 확인하세요.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!validOrigin(request)) return errorResponse("FORBIDDEN", "요청 출처를 확인하세요.", 403);
  const viewer = await getCurrentUser(request.headers);
  // 조건 `!viewer`: 참이면 `errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!viewer) return errorResponse("UNAUTHENTICATED", "학생 로그인이 필요합니다.", 401);
  // 조건 `!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT"`: 참이면 `errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!viewer.emailVerified`: 거짓인 경우에만 오른쪽 `viewer.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!viewer.emailVerified || viewer.status !== "ACTIVE_STUDENT") return errorResponse("FORBIDDEN", "학생 인증이 필요합니다.", 403);
  // 예외 처리: 본문 실행 중 예외가 발생하면 `error instanceof InvalidImageError` 조건을 추가로 검사한다.
  try {
    const form = await readBoundedMultipart(request);
    const files = form.getAll("file");
    // 조건 `files.length !== 1 || !(files[0] instanceof File) || [...form.keys()].some(k => k !== "file")`: 참이면 `errorResponse("INVALID_INPUT", "이미지 파일 하나를 선택하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `files.length !== 1 || !(files[0] instanceof File)`: 거짓인 경우에만 오른쪽 `[...form.keys()].some(k => k !== "file")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `files.length !== 1`: 거짓인 경우에만 오른쪽 `!(files[0] instanceof File)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 기능 `콜백`(k): `k !== "file"` 평가 결과를 반환한다.
    if (files.length !== 1 || !(files[0] instanceof File) || [...form.keys()].some(k => k !== "file")) return errorResponse("INVALID_INPUT", "이미지 파일 하나를 선택하세요.", 400);
    const file = files[0];
    const asset = await saveImage(getDb(), getObjectStore(), viewer.id, Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // 조건 `error instanceof InvalidImageError`: 참이면 `errorResponse("INVALID_INPUT", error.message, 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    if (error instanceof InvalidImageError) return errorResponse("INVALID_INPUT", error.message, 400);
    // 조건 `error instanceof Error && error.message === "TOO_LARGE"`: 참이면 `errorResponse("TOO_LARGE", "이미지 크기는 5MB 이하여야 합니다.", 413)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `error instanceof Error`: 참인 경우에만 오른쪽 `error.message === "TOO_LARGE"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (error instanceof Error && error.message === "TOO_LARGE") return errorResponse("TOO_LARGE", "이미지 크기는 5MB 이하여야 합니다.", 413);
    // 조건 `error instanceof TypeError || (error instanceof Error && error.message === "INVALID_MULTIPART")`: 참이면 `errorResponse("INVALID_INPUT", "파일 업로드 요청을 확인하세요.", 400)`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 단락 분기 `error instanceof TypeError`: 거짓인 경우에만 오른쪽 `(error instanceof Error && error.message === "INVALID_MULTIPART")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    // 단락 분기 `error instanceof Error`: 참인 경우에만 오른쪽 `error.message === "INVALID_MULTIPART"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
    if (error instanceof TypeError || (error instanceof Error && error.message === "INVALID_MULTIPART")) return errorResponse("INVALID_INPUT", "파일 업로드 요청을 확인하세요.", 400);
    console.error("Media upload failed");
    return errorResponse("STORAGE_ERROR", "이미지를 저장하지 못했습니다.", 500);
  }
}
