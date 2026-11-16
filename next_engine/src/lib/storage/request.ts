/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
import { MAX_IMAGE_BYTES } from "./image";
export const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
// 기능 `validOrigin`(request): 먼저 `const base = process.env.BETTER_AUTH_URL;`를 실행한다.
export function validOrigin(request: Request) {
  const base = process.env.BETTER_AUTH_URL;
  // 조건 `!base`: 참이면 `false`를 반환한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!base) return false;
  // 예외 처리: 본문 실행 중 예외가 발생하면 `false`를 반환한다.
  try { return request.headers.get("origin") === new URL(base).origin; } catch { return false; }
}
/** Bound the actual stream, including chunked requests, before parsing multipart data. */
// Content-Length뿐 아니라 실제 수신 스트림도 제한한 뒤 multipart를 해석한다.
// 기능 `readBoundedMultipart`(request): `!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")` 조건을 추가로 검사한다.
export async function readBoundedMultipart(request: Request) {
  // 조건 `!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")`: 참이면 `new Error("INVALID_MULTIPART")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `request.headers.get("content-type")`: null 또는 undefined인 경우에만 오른쪽 `""`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new Error("INVALID_MULTIPART");
  const length = request.headers.get("content-length");
  // 조건 `length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)`: 참이면 `new Error("TOO_LARGE")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  // 단락 분기 `length`: 참인 경우에만 오른쪽 `(!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  // 단락 분기 `!/^\d+$/.test(length)`: 거짓인 경우에만 오른쪽 `Number(length) > MAX_REQUEST_BYTES`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new Error("TOO_LARGE");
  // 조건 `!request.body`: 참이면 `new Error("INVALID_MULTIPART")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!request.body) throw new Error("INVALID_MULTIPART");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  // 예외 처리: 본문 실행 중 예외가 발생하면 호출자에게 전달한다. 성공·실패 모두 마지막에 먼저 `reader.releaseLock();`를 실행한다.
  try {
    // 반복 조건 `true`: 조건이 참인 동안 본문을 실행하고 거짓이면 반복을 종료한다.
    // 조건 `done`: 참이면 현재 반복 또는 switch를 종료한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    // 조건 `size > MAX_REQUEST_BYTES`: 참이면 먼저 `await reader.cancel();`를 실행한다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("TOO_LARGE"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  // 기능 `콜백`(c): `Buffer.from(c)` 평가 결과를 반환한다.
  const body = Buffer.concat(chunks.map(c => Buffer.from(c)));
  const bounded = new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body });
  return bounded.formData();
}
