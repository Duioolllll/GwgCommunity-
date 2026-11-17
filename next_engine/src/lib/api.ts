import { NextResponse } from "next/server";

// API 오류에는 요청별 식별자를 포함하고 JSON 파싱 실패는 null로 통일한다.
// 오류 코드와 안내 문장을 응답에 담아 보낸다.
export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message, requestId: crypto.randomUUID() }, { status });
}

// 요청 본문을 자료로 읽고 읽을 수 없으면 빈 결과로 처리한다.
export function jsonBody(request: Request) {
  // 이 화면 요소에 연결한 동작을 사용자의 입력이나 클릭에 맞춰 실행한다.
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
