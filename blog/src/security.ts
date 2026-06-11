import type { Context } from "hono";

export function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": "default-src 'self'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function isSafeRedirect(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  return true;
}

export function safeRedirectTarget(next: string | null | undefined): string {
  return isSafeRedirect(next) ? next! : "/";
}

export function jsonError(error: string, status: number): Response {
  return withSecurityHeaders(
    Response.json({ ok: false, error }, { status })
  );
}

export function attachSecurityHeaders(c: { header: (name: string, value: string) => void }) {
  for (const [key, value] of Object.entries(securityHeaders())) {
    c.header(key, value);
  }
}

export function respondHtml(c: Context, body: string, status = 200) {
  attachSecurityHeaders(c);
  return c.html(body, status as 200);
}

export function htmlResponse(body: string, status = 200): Response {
  return withSecurityHeaders(
    new Response(body, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
}
