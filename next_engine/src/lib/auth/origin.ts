/** Require the configured site's exact origin on cookie-authenticated mutations. */
export function hasTrustedOrigin(request: Request): boolean {
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured) throw new Error("BETTER_AUTH_URL is required");
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(configured).origin;
}
