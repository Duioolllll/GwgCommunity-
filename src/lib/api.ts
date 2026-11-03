import { NextResponse } from "next/server";

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, message, requestId: crypto.randomUUID() }, { status });
}

export function jsonBody(request: Request) {
  return request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}
