/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse, type NextRequest } from "next/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// Browser cookie authentication requires a trusted Origin for every API mutation.
// API 변경 요청에만 신뢰할 수 있는 Origin을 요구한다.
// 기능 `middleware`(request): `!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)` 조건을 추가로 검사한다.
export function middleware(request: NextRequest) {
  // 조건 `!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)`: 참이면 `NextResponse.next()`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return NextResponse.next();
  // 조건 `!process.env.BETTER_AUTH_URL`: 참이면 `NextResponse.json({ code: "CONFIGURATION_ERROR", message: "서버 설정을 확인하세요.", requestId: crypto.randomUUID() }, { status: 503 })`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!process.env.BETTER_AUTH_URL) return NextResponse.json({ code: "CONFIGURATION_ERROR", message: "서버 설정을 확인하세요.", requestId: crypto.randomUUID() }, { status: 503 });
  // 조건 `!hasTrustedOrigin(request)`: 참이면 `NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "허용되지 않은 요청입니다.", requestId: crypto.randomUUID() }, { status: 403 })`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!hasTrustedOrigin(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "허용되지 않은 요청입니다.", requestId: crypto.randomUUID() }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
