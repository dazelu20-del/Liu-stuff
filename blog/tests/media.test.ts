import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/index";
import schema from "../schema.sql?raw";
import { serveMedia } from "../src/media";

async function run(path: string, init?: RequestInit) {
  const ctx = createExecutionContext();
  const response = await app.request(path, init, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe("media", () => {
  beforeAll(async () => {
    await env.DB.exec("PRAGMA foreign_keys = ON");
    for (const statement of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
      await env.DB.prepare(statement).run();
    }
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash) VALUES (1, 'media1', 'm1@test.com', 'hash')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash) VALUES (2, 'media2', 'm2@test.com', 'hash')"
    ).run();
  });

  it("serves D1 BLOB returned as number array", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await env.DB.prepare("INSERT INTO media_assets (user_id, mime_type, data) VALUES (?, ?, ?)")
      .bind(1, "image/png", bytes.buffer)
      .run();

    const row = await env.DB.prepare("SELECT id FROM media_assets LIMIT 1").first<{ id: number }>();
    const response = await serveMedia(env.DB, row!.id);
    expect(response).not.toBeNull();
    expect(response!.headers.get("Content-Type")).toBe("image/png");
    const body = new Uint8Array(await response!.arrayBuffer());
    expect(body[0]).toBe(0x89);
    expect(body[1]).toBe(0x50);
  });

  it("GET /media/:id returns image bytes", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await env.DB.prepare("INSERT INTO media_assets (user_id, mime_type, data) VALUES (?, ?, ?)")
      .bind(2, "image/png", png.buffer)
      .run();
    const id = Number(result.meta.last_row_id);

    const res = await run(`/media/${id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.length).toBeGreaterThan(0);
  });
});
