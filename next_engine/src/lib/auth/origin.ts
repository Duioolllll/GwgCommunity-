/** 로그인 쿠키로 자료를 바꾸는 요청은 설정한 사이트에서 보낸 요청인지 정확히 확인한다. */
// 요청 출처가 신뢰된 출처인지 확인한다.
// 요청이 허용한 사이트에서 왔는지 확인한다.
export function hasTrustedOrigin(request: Request): boolean {
  const configured = process.env.BETTER_AUTH_URL;
  // 확인할 조건: configured 없음 또는 false. 해당하면 오류를 알려서 이 요청의 처리를 중단한다.
  if (!configured) throw new Error("BETTER_AUTH_URL is required");
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(configured).origin;
}
