import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import app from "../src/index";
import schema from "../schema.sql?raw";

async function run(path: string, init?: RequestInit) {
  const ctx = createExecutionContext();
  const response = await app.request(path, init, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

function cookieHeader(setCookie: string | null): string {
  return setCookie?.split(";")[0] ?? "";
}

async function getCsrf(): Promise<{ cookie: string; token: string }> {
  const res = await run("/signup");
  const html = await res.text();
  const match = html.match(/name="csrf_token" value="([^"]+)"/);
  return { cookie: cookieHeader(res.headers.get("Set-Cookie")), token: match?.[1] ?? "" };
}

describe("blog app", () => {
  beforeAll(async () => {
    await env.DB.exec("PRAGMA foreign_keys = ON");
    for (const statement of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
      await env.DB.prepare(statement).run();
    }
  });

  beforeEach(async () => {
    await env.DB.exec("DELETE FROM reactions");
    await env.DB.exec("DELETE FROM comments");
    await env.DB.exec("DELETE FROM posts");
    await env.DB.exec("DELETE FROM users");
  });

  it("session cookie roundtrip", async () => {
    const { signSession, readSession, randomToken } = await import("../src/crypto");
    const data = { userId: 0, username: "", csrfToken: randomToken(16) };
    const signed = await signSession(data, "dev");
    const read = await readSession(signed, "dev");
    expect(read?.csrfToken).toBe(data.csrfToken);
  });

  it("GET / returns 200", async () => {
    const res = await run("/");
    expect(res.status).toBe(200);
  });

  it("session cookie header roundtrip", async () => {
    const { signSession, readSession, getSecret, randomToken, sessionCookie } = await import("../src/crypto");
    const data = { userId: 0, username: "", csrfToken: randomToken(16) };
    const signed = await signSession(data, getSecret(env));
    const value = sessionCookie(signed, false).split(";")[0].replace(/^session=/, "");
    const read = await readSession(value, getSecret(env));
    expect(read?.csrfToken).toBe(data.csrfToken);
  });

  it("signup page cookie matches csrf field", async () => {
    const page = await run("/signup");
    const cookie = cookieHeader(page.headers.get("Set-Cookie"));
    const html = await page.text();
    const token = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
    const { readSession, getSecret } = await import("../src/crypto");
    const session = await readSession(cookie.replace(/^session=/, ""), getSecret(env));
    expect(session?.csrfToken).toBe(token);
  });

  it("signup and login flow", async () => {
    const { cookie, token } = await getCsrf();
    const signup = await run("/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      },
      body: new URLSearchParams({
        csrf_token: token,
        username: "alice",
        email: "alice@example.com",
        password: "password1",
      }).toString(),
    });
    expect(signup.status, await signup.text()).toBe(302);
    expect(signup.headers.get("Location")).toBe("/login");

    const loginPage = await run("/login", { headers: { Cookie: cookie } });
    const loginCookie = cookieHeader(loginPage.headers.get("Set-Cookie")) || cookie;
    const loginHtml = await loginPage.text();
    const loginToken = loginHtml.match(/name="csrf_token" value="([^"]+)"/)?.[1] ?? "";

    const login = await run("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: loginCookie,
      },
      body: new URLSearchParams({
        csrf_token: loginToken,
        username: "alice",
        password: "password1",
      }).toString(),
    });
    expect(login.status).toBe(302);
  });

  it("rejects POST without CSRF token", async () => {
    const res = await run("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "bob",
        email: "bob@example.com",
        password: "password1",
      }).toString(),
    });
    expect(res.status).toBe(400);
  });

  it("search empty query shows prompt", async () => {
    const res = await run("/search");
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain("Enter a search term");
  });
});
