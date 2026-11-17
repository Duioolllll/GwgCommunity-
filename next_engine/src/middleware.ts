import { NextResponse, type NextRequest } from "next/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// 로그인 쿠키를 악용한 요청을 막기 위해 자료를 바꾸는 요청은 허용된 사이트에서 보냈는지 확인한다.
// API 변경 요청에만 신뢰할 수 있는 Origin을 요구한다.
// 화면이나 API에 접근하기 전에 공통으로 필요한 요청 처리를 한다.
export function middleware(request: NextRequest) {
  // 자료를 읽기만 하는 요청은 그대로 보낸다. 자료를 바꾸는 요청만 아래의 출처 검사를 받는다.
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return NextResponse.next();
  // 서비스의 기준 주소가 설정되지 않았다면 요청을 처리하지 않고 설정 오류를 알린다.
  if (!process.env.BETTER_AUTH_URL) return NextResponse.json({ code: "CONFIGURATION_ERROR", message: "서버 설정을 확인하세요.", requestId: crypto.randomUUID() }, { status: 503 });
  // 허용된 사이트에서 보낸 요청이 아니면 다른 사이트의 대리 요청일 수 있으므로 차단한다.
  if (!hasTrustedOrigin(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "허용되지 않은 요청입니다.", requestId: crypto.randomUUID() }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
