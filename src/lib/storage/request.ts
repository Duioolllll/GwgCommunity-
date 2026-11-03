import { MAX_IMAGE_BYTES } from "./image";
export const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
export function validOrigin(request: Request) {
  const base = process.env.BETTER_AUTH_URL;
  if (!base) return false;
  try { return request.headers.get("origin") === new URL(base).origin; } catch { return false; }
}
/** Bound the actual stream, including chunked requests, before parsing multipart data. */
export async function readBoundedMultipart(request: Request) {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "")) throw new Error("INVALID_MULTIPART");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new Error("TOO_LARGE");
  if (!request.body) throw new Error("INVALID_MULTIPART");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new Error("TOO_LARGE"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const body = Buffer.concat(chunks.map(c => Buffer.from(c)));
  const bounded = new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body });
  return bounded.formData();
}
