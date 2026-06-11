import { getSecretKey, timingSafeEqual } from "./util";
import type { SessionData } from "./types";

const PBKDF2_ITERATIONS = 100_000;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}$${toHex(salt.buffer)}$${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || !parts[0].startsWith("pbkdf2:")) return false;
  const iterations = Number(parts[0].slice("pbkdf2:".length));
  const salt = fromHex(parts[1]);
  const expected = parts[2];
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return timingSafeEqual(toHex(derived), expected);
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(data: SessionData, secret: string): Promise<string> {
  const payload = bytesToHex(new TextEncoder().encode(JSON.stringify(data)));
  const key = await importKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  );
  return `${payload}.${bytesToHex(sig)}`;
}

export async function readSession(
  cookie: string | undefined,
  secret: string
): Promise<SessionData | null> {
  if (!cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = cookie.slice(0, dot);
  const sigHex = cookie.slice(dot + 1);
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromHex(sigHex),
    new TextEncoder().encode(payload)
  );
  if (!valid) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromHex(payload))) as SessionData;
  } catch {
    return null;
  }
}

export function sessionCookie(
  value: string,
  secure: boolean,
  maxAge = 60 * 60 * 24 * 7
): string {
  const flags = [
    `session=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const flags = ["session=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export async function createSession(
  userId: number,
  username: string,
  secret: string
): Promise<{ token: string; csrfToken: string }> {
  const csrfToken = randomToken(16);
  const token = await signSession({ userId, username, csrfToken }, secret);
  return { token, csrfToken };
}

export function validateCsrf(
  session: SessionData | null,
  token: string | null | undefined
): boolean {
  if (!session || !token) return false;
  return timingSafeEqual(session.csrfToken, token);
}

export function getSecret(env: { SECRET_KEY?: string }): string {
  return getSecretKey(env);
}
