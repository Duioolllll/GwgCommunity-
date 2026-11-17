import { MAX_IMAGE_BYTES } from "./image";
export const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
// 파일 요청이 허용한 사이트에서 왔는지 확인한다.
export function validOrigin(request: Request) {
  const base = process.env.BETTER_AUTH_URL;
  // 서비스의 기준 주소를 설정하지 않았으면 안전한 요청인지 확인할 수 없어 허용하지 않는다.
  if (!base) return false;
  // 요청을 보낸 사이트 주소와 서비스 주소가 같은지 비교한다. 주소를 읽을 수 없으면 허용하지 않는다.
  try { return request.headers.get("origin") === new URL(base).origin; } catch { return false; }
}
/** 파일 업로드 내용을 읽기 전에 실제로 받은 자료의 크기를 제한한다. 잘게 나누어 보낸 요청도 합산한다. */
// Content-Length뿐 아니라 실제 수신 스트림도 제한한 뒤 multipart를 해석한다.
// 업로드 크기를 제한하며 요청에서 이미지 파일을 꺼낸다.
export async function readBoundedMultipart(request: Request) {
  // 이미지 파일을 주고받는 업로드 형식의 요청인지 먼저 확인한다. 다른 형식이면 받지 않는다.
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new Error("INVALID_MULTIPART");
  const length = request.headers.get("content-length");
  // 요청에 적힌 파일 크기가 숫자가 아니거나 최대 허용 크기를 넘으면 읽기 전에 거절한다.
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new Error("TOO_LARGE");
  // 업로드할 본문이 없으면 정상적인 파일 요청이 아니므로 중단한다.
  if (!request.body) throw new Error("INVALID_MULTIPART");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  // 아래 작업을 시도한다. 오류가 나면 이 함수를 호출한 곳에 알린다. 성공하거나 실패한 뒤에는 반드시 아래에 있는 작업을 실행한다.
  try {
    // 자료를 조금씩 읽으며 크기를 합산한다. 읽기가 끝나면 멈추고, 허용 크기를 넘는 순간 읽기를 취소하고 오류를 알린다.
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("TOO_LARGE"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  // 목록의 각 항목을 화면이나 다른 값으로 바꾼다.
  const body = Buffer.concat(chunks.map(c => Buffer.from(c)));
  const bounded = new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body });
  return bounded.formData();
}
