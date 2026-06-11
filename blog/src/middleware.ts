import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, SessionData } from "./types";
import { getSecret, readSession, validateCsrf } from "./crypto";
import { jsonError, htmlResponse } from "./security";

export async function getSession(c: Context<{ Bindings: Env }>): Promise<SessionData | null> {
  let cookie = getCookie(c, "session");
  if (!cookie) {
    const header = c.req.header("Cookie") ?? "";
    const match = header.match(/(?:^|;\s*)session=([^;]*)/);
    cookie = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }
  return readSession(cookie, getSecret(c.env));
}

export async function requireCsrf(c: Context<{ Bindings: Env }>, isApi: boolean): Promise<Response | null> {
  const session = await getSession(c);
  const headerToken = c.req.header("X-CSRF-Token");
  const form = await c.req.parseBody();
  const formToken = typeof form.csrf_token === "string" ? form.csrf_token : null;
  const token = headerToken || formToken;

  if (!validateCsrf(session, token)) {
    if (isApi) {
      return jsonError("Invalid or missing CSRF token.", 400);
    }
    return htmlResponse("<p>Invalid or missing CSRF token.</p>", 400);
  }

  c.set("parsedBody", form);
  c.set("session", session);
  return null;
}

export async function requireLogin(c: Context<{ Bindings: Env }>): Promise<SessionData | Response> {
  const session = (c.get("session") as SessionData | undefined) ?? (await getSession(c));
  if (!session?.userId) {
    const path = new URL(c.req.url).pathname;
    return c.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  return session;
}

export async function requireLoginJson(c: Context<{ Bindings: Env }>): Promise<SessionData | Response> {
  const session = (c.get("session") as SessionData | undefined) ?? (await getSession(c));
  if (!session?.userId) {
    return jsonError("Please log in first.", 401);
  }
  return session;
}
