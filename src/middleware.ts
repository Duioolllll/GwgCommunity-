import { NextResponse, type NextRequest } from "next/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";

// Browser cookie authentication requires a trusted Origin for every API mutation.
export function middleware(request: NextRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return NextResponse.next();
  if (!process.env.BETTER_AUTH_URL) return NextResponse.json({ code: "CONFIGURATION_ERROR", message: "서버 설정을 확인하세요.", requestId: crypto.randomUUID() }, { status: 503 });
  if (!hasTrustedOrigin(request)) return NextResponse.json({ code: "UNTRUSTED_ORIGIN", message: "허용되지 않은 요청입니다.", requestId: crypto.randomUUID() }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
