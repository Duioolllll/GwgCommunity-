/* 제출용 주석: 함수 역할, 조건의 참·거짓 결과, 단락 평가 및 예외·반복 경로를 설명한다. */
/** Require the configured site's exact origin on cookie-authenticated mutations. */
// 요청 출처가 신뢰된 출처인지 확인한다.
// 기능 `hasTrustedOrigin`(request): 먼저 `const configured = process.env.BETTER_AUTH_URL;`를 실행한다.
export function hasTrustedOrigin(request: Request): boolean {
  const configured = process.env.BETTER_AUTH_URL;
  // 조건 `!configured`: 참이면 `new Error("BETTER_AUTH_URL is required")` 예외를 발생시킨다. 거짓이면 별도 처리 없이 다음 구문으로 진행한다.
  if (!configured) throw new Error("BETTER_AUTH_URL is required");
  const origin = request.headers.get("origin");
  // 단락 분기 `origin !== null`: 참인 경우에만 오른쪽 `origin === new URL(configured).origin`를 평가한다. 그 외에는 왼쪽 값을 유지한다.
  return origin !== null && origin === new URL(configured).origin;
}
