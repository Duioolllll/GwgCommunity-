/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { ModerationError } from "./service";
// 세션 사용자와 학생 인증 상태를 확인하고 요청 시 관리자 역할도 검사한다.
// 기능 `actor`(admin): 먼저 `const current = await getCurrentUser(await headers());`를 실행한다.
export async function actor(admin = false) {
  const current = await getCurrentUser(await headers());
  // 조건 `!current`: 참이면 `{ error: errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401), viewer: null }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!current) return { error: errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401), viewer: null };
  // 조건 `!current.emailVerified || current.status !== "ACTIVE_STUDENT" || (admin && current.role !== "admin")`: 참이면 `{ error: errorResponse("FORBIDDEN", "접근 권한이 없습니다.", 403), viewer: null }`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `!current.emailVerified || current.status !== "ACTIVE_STUDENT"`: 거짓인 경우에만 오른쪽 `(admin && current.role !== "admin")`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!current.emailVerified`: 거짓인 경우에만 오른쪽 `current.status !== "ACTIVE_STUDENT"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `admin`: 참인 경우에만 오른쪽 `current.role !== "admin"`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!current.emailVerified || current.status !== "ACTIVE_STUDENT" || (admin && current.role !== "admin")) return { error: errorResponse("FORBIDDEN", "접근 권한이 없습니다.", 403), viewer: null };
  return { viewer: current, error: null };
}
// 운영 서비스 오류를 권한·대상 없음·충돌 HTTP 응답으로 변환한다.
// 기능 `failure`(error): `!(error instanceof ModerationError)` 조건을 추가로 검사한다.
export function failure(error: unknown) {
  // 조건 `!(error instanceof ModerationError)`: 참이면 `error` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!(error instanceof ModerationError)) throw error;
  // 선택 조건 `error.code === "FORBIDDEN"`: 참이면 `403`, 거짓이면 `error.code === "NOT_FOUND" ? 404 : 409`를 사용한다.
  // 선택 조건 `error.code === "NOT_FOUND"`: 참이면 `404`, 거짓이면 `409`를 사용한다.
  const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
  // 선택 조건 `status === 409`: 참이면 `"이미 처리되었거나 대상이 변경되었습니다."`, 거짓이면 `status === 404 ? "대상을 찾을 수 없습니다." : "접근 권한이 없습니다."`를 사용한다.
  // 선택 조건 `status === 404`: 참이면 `"대상을 찾을 수 없습니다."`, 거짓이면 `"접근 권한이 없습니다."`를 사용한다.
  return errorResponse(error.code, status === 409 ? "이미 처리되었거나 대상이 변경되었습니다." : status === 404 ? "대상을 찾을 수 없습니다." : "접근 권한이 없습니다.", status);
}
// 요청 Content-Type이 JSON인지 확인한다.
// 기능 `isJson`(request): `/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")`를 반환한다.
// 단락 분기 `request.headers.get("content-type")`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
export function isJson(request: Request) { return /^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""); }
