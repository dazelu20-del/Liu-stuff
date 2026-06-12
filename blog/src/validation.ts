const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3-30 letters, digits, or underscores.";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!EMAIL_RE.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "Title cannot be empty.";
  if (trimmed.length > 200) return "Title must be at most 200 characters.";
  return null;
}

export function validateBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Body cannot be empty.";
  if (trimmed.length > 50000) return "Post content is too large.";
  return null;
}

export function validateComment(body: unknown): string | null {
  if (typeof body !== "string") return "Comment must be text.";
  const trimmed = body.trim();
  if (!trimmed) return "Comment cannot be empty.";
  if (trimmed.length > 2000) return "Comment must be at most 2000 characters.";
  return null;
}

export function validateReactionKind(kind: unknown): string | null {
  if (kind !== "like" && kind !== "dislike") {
    return "Reaction must be 'like' or 'dislike'.";
  }
  return null;
}

export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, 100);
}

export function isTextOnly(value: string): boolean {
  return typeof value === "string";
}
