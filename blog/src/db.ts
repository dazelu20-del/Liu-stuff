import type { D1Database } from "@cloudflare/workers-types";

export async function withDb<T>(db: D1Database, fn: (db: D1Database) => Promise<T>): Promise<T> {
  await db.prepare("PRAGMA foreign_keys = ON").run();
  return fn(db);
}
