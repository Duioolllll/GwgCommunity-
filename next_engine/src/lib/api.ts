/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { NextResponse } from "next/server";

// API 오류에는 요청별 식별자를 포함하고 JSON 파싱 실패는 null로 통일한다.
// 기능 `errorResponse`(code, message, status): `NextResponse.json({ code, message, requestId: crypto.randomUUID() }, { status })`를 반환한다.
export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message, requestId: crypto.randomUUID() }, { status });
}

// 기능 `jsonBody`(request): `request.json().catch(() => null) as Promise<Record<string, unknown> | null>`를 반환한다.
export function jsonBody(request: Request) {
  // 기능 `콜백`(): `null` 평가 결과를 반환한다.
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
