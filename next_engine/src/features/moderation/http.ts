import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { ModerationError } from "./service";
// 세션 사용자와 학생 인증 상태를 확인하고 요청 시 관리자 역할도 검사한다.
// 로그인 상태와 필요한 권한을 확인한다.
export async function actor(admin = false) {
  const current = await getCurrentUser(await headers());
  // 로그인한 사용자가 없으면 로그인 안내와 401 응답을 보낸다.
  if (!current) return { error: errorResponse("UNAUTHENTICATED", "로그인이 필요합니다.", 401), viewer: null };
  // 이메일·학생 인증을 마치지 않았거나 필요한 관리자 권한이 없으면 접근을 거절한다.
  if (!current.emailVerified || current.status !== "ACTIVE_STUDENT" || (admin && current.role !== "admin")) return { error: errorResponse("FORBIDDEN", "접근 권한이 없습니다.", 403), viewer: null };
  return { viewer: current, error: null };
}
// 운영 서비스 오류를 권한·대상 없음·충돌 HTTP 응답으로 변환한다.
// 발생한 오류를 요청자에게 보여줄 오류 응답으로 바꾼다.
export function failure(error: unknown) {
  // 여기서 정한 업무 오류가 아니면 다른 오류 처리 코드가 맡도록 그대로 전달한다.
  if (!(error instanceof ModerationError)) throw error;
  // 권한 부족은 403, 대상 없음은 404, 이미 처리되어 상태가 달라진 경우는 409로 알린다.
  const status = error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : 409;
  // 위에서 정한 상태에 맞춰 권한 부족·대상 없음·이미 처리됨 중 알맞은 안내를 보낸다.
  return errorResponse(error.code, status === 409 ? "이미 처리되었거나 대상이 변경되었습니다." : status === 404 ? "대상을 찾을 수 없습니다." : "접근 권한이 없습니다.", status);
}
// 요청 Content-Type이 JSON인지 확인한다.
// 서버가 해석할 수 있는 JSON 형식의 요청인지 확인한다.
// request의 요청에 붙은 부가 정보에서 찾은 “content-type”이 비어 있으면 빈 글자를 대신 사용한다.
export function isJson(request: Request) { return /^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""); }
