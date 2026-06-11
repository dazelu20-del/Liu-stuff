export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncatePreview(text: string, max = 150): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return `${base}...`;
}

export function escapeLikePattern(query: string): string {
  return query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function getSecretKey(env: { SECRET_KEY?: string }): string {
  return env.SECRET_KEY || "dev";
}

export function isSecureRequest(url: URL): boolean {
  return url.protocol === "https:";
}
