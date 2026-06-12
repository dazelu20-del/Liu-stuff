import type { D1Database } from "@cloudflare/workers-types";
import { withDb } from "./db";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export interface UploadResult {
  id: number;
  url: string;
}

export function mediaUrl(id: number): string {
  return `/media/${id}`;
}

function detectMime(file: File, bytes: ArrayBuffer): string | null {
  if (file.type && IMAGE_TYPES.has(file.type)) {
    return file.type;
  }

  const lower = file.name.toLowerCase();
  for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    if (lower.endsWith(ext)) return mime;
  }

  const view = new Uint8Array(bytes);
  if (view.length >= 2 && view[0] === 0xff && view[1] === 0xd8) return "image/jpeg";
  if (view.length >= 4 && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) {
    return "image/png";
  }
  if (view.length >= 12) {
    const riff = String.fromCharCode(view[0], view[1], view[2], view[3]);
    const webp = String.fromCharCode(view[8], view[9], view[10], view[11]);
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }

  return null;
}

export async function validateAndUpload(
  db: D1Database,
  userId: number,
  file: File
): Promise<UploadResult | string> {
  if (!(file instanceof File) || file.size === 0) {
    return "Please choose a file to upload.";
  }

  const bytes = await file.arrayBuffer();
  const mime = detectMime(file, bytes);

  if (!mime) {
    return "Only JPEG, PNG, and WebP images are allowed.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 2 MB or smaller.";
  }

  const id = await withDb(db, async (d) => {
    const result = await d
      .prepare("INSERT INTO media_assets (user_id, mime_type, data) VALUES (?, ?, ?)")
      .bind(userId, mime, bytes)
      .run();
    return Number(result.meta.last_row_id);
  });

  return { id, url: mediaUrl(id) };
}

function toBodyBytes(data: unknown): Uint8Array | null {
  if (data == null) return null;
  // D1 returns BLOB columns as a plain number Array, not ArrayBuffer
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

export async function serveMedia(db: D1Database, id: number): Promise<Response | null> {
  if (!Number.isInteger(id) || id <= 0) return null;

  const row = await withDb(db, async (d) => {
    return d
      .prepare("SELECT mime_type, data FROM media_assets WHERE id = ?")
      .bind(id)
      .first<{ mime_type: string; data: unknown }>();
  });

  if (!row) return null;

  const body = toBodyBytes(row.data);
  if (!body) return null;

  const headers = new Headers();
  headers.set("Content-Type", row.mime_type);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(body, { headers });
}

async function mediaOwnedByUser(
  db: D1Database,
  id: number,
  authorId: number
): Promise<boolean> {
  const row = await withDb(db, async (d) => {
    return d
      .prepare("SELECT user_id FROM media_assets WHERE id = ?")
      .bind(id)
      .first<{ user_id: number }>();
  });
  return !!row && row.user_id === authorId;
}

export async function verifyDocumentMedia(
  db: D1Database,
  blocks: { type: string; id?: number }[],
  authorId: number
): Promise<string | null> {
  for (const block of blocks) {
    if (block.type !== "media" || typeof block.id !== "number") continue;
    if (!(await mediaOwnedByUser(db, block.id, authorId))) {
      return "Media must belong to your account.";
    }
  }
  return null;
}

export async function verifyHtmlMedia(
  db: D1Database,
  html: string,
  authorId: number
): Promise<string | null> {
  const ids = new Set<number>();
  for (const match of html.matchAll(/\/media\/(\d+)/gi)) {
    ids.add(Number(match[1]));
  }
  for (const id of ids) {
    if (!(await mediaOwnedByUser(db, id, authorId))) {
      return "Media must belong to your account.";
    }
  }
  return null;
}

export async function verifySideImages(
  db: D1Database,
  sideImages: { id: number }[] | undefined,
  authorId: number
): Promise<string | null> {
  if (!sideImages?.length) return null;
  for (const img of sideImages) {
    if (!(await mediaOwnedByUser(db, img.id, authorId))) {
      return "Media must belong to your account.";
    }
  }
  return null;
}
