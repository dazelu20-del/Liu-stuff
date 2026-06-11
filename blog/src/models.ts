import type { D1Database } from "@cloudflare/workers-types";
import { withDb } from "./db";
import type { Comment, Post, ReactionKind, User } from "./types";
import { escapeLikePattern } from "./util";

export async function findUserByUsername(db: D1Database, username: string): Promise<User | null> {
  return withDb(db, async (d) => {
    return d
      .prepare("SELECT id, username, email, password_hash, created_at FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username)
      .first<User>();
  });
}

export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  return withDb(db, async (d) => {
    return d
      .prepare("SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?")
      .bind(email.toLowerCase())
      .first<User>();
  });
}

export async function createUser(
  db: D1Database,
  username: string,
  email: string,
  passwordHash: string
): Promise<number> {
  return withDb(db, async (d) => {
    const result = await d
      .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .bind(username, email.toLowerCase(), passwordHash)
      .run();
    return Number(result.meta.last_row_id);
  });
}

export async function listPosts(db: D1Database): Promise<Post[]> {
  return withDb(db, async (d) => {
    const { results } = await d
      .prepare(
        `SELECT p.id, p.author_id, p.title, p.body, p.created_at, p.updated_at, u.username AS author
         FROM posts p JOIN users u ON u.id = p.author_id
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .all<Post>();
    return results ?? [];
  });
}

export async function searchPosts(db: D1Database, query: string): Promise<Post[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  return withDb(db, async (d) => {
    const { results } = await d
      .prepare(
        `SELECT p.id, p.author_id, p.title, p.body, p.created_at, p.updated_at, u.username AS author
         FROM posts p JOIN users u ON u.id = p.author_id
         WHERE p.title LIKE ? ESCAPE '\\' OR p.body LIKE ? ESCAPE '\\'
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .bind(pattern, pattern)
      .all<Post>();
    return results ?? [];
  });
}

export async function getPost(db: D1Database, id: number): Promise<Post | null> {
  return withDb(db, async (d) => {
    return d
      .prepare(
        `SELECT p.id, p.author_id, p.title, p.body, p.created_at, p.updated_at, u.username AS author
         FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`
      )
      .bind(id)
      .first<Post>();
  });
}

export async function createPost(
  db: D1Database,
  authorId: number,
  title: string,
  body: string
): Promise<number> {
  return withDb(db, async (d) => {
    const result = await d
      .prepare("INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)")
      .bind(authorId, title, body)
      .run();
    return Number(result.meta.last_row_id);
  });
}

export async function updatePost(
  db: D1Database,
  id: number,
  authorId: number,
  title: string,
  body: string
): Promise<boolean> {
  return withDb(db, async (d) => {
    const result = await d
      .prepare(
        `UPDATE posts SET title = ?, body = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND author_id = ?`
      )
      .bind(title, body, id, authorId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  });
}

export async function deletePost(db: D1Database, id: number, authorId: number): Promise<boolean> {
  return withDb(db, async (d) => {
    const result = await d
      .prepare("DELETE FROM posts WHERE id = ? AND author_id = ?")
      .bind(id, authorId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  });
}

export async function listComments(db: D1Database, postId: number): Promise<Comment[]> {
  return withDb(db, async (d) => {
    const { results } = await d
      .prepare(
        `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at, u.username AS author
         FROM comments c JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`
      )
      .bind(postId)
      .all<Comment>();
    return results ?? [];
  });
}

export async function createComment(
  db: D1Database,
  postId: number,
  userId: number,
  body: string
): Promise<Comment> {
  return withDb(db, async (d) => {
    const result = await d
      .prepare("INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)")
      .bind(postId, userId, body)
      .run();
    const id = Number(result.meta.last_row_id);
    const row = await d
      .prepare(
        `SELECT c.id, c.post_id, c.user_id, c.body, c.created_at, u.username AS author
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
      )
      .bind(id)
      .first<Comment>();
    return row!;
  });
}

export async function getReactionCounts(
  db: D1Database,
  postId: number
): Promise<{ like: number; dislike: number }> {
  return withDb(db, async (d) => {
    const likes = await d
      .prepare("SELECT COUNT(*) AS c FROM reactions WHERE post_id = ? AND kind = 'like'")
      .bind(postId)
      .first<{ c: number }>();
    const dislikes = await d
      .prepare("SELECT COUNT(*) AS c FROM reactions WHERE post_id = ? AND kind = 'dislike'")
      .bind(postId)
      .first<{ c: number }>();
    return { like: likes?.c ?? 0, dislike: dislikes?.c ?? 0 };
  });
}

export async function getUserReaction(
  db: D1Database,
  postId: number,
  userId: number
): Promise<ReactionKind | null> {
  return withDb(db, async (d) => {
    const row = await d
      .prepare("SELECT kind FROM reactions WHERE post_id = ? AND user_id = ?")
      .bind(postId, userId)
      .first<{ kind: ReactionKind }>();
    return row?.kind ?? null;
  });
}

export async function toggleReaction(
  db: D1Database,
  postId: number,
  userId: number,
  kind: ReactionKind
): Promise<ReactionKind | null> {
  return withDb(db, async (d) => {
    const existing = await d
      .prepare("SELECT id, kind FROM reactions WHERE post_id = ? AND user_id = ?")
      .bind(postId, userId)
      .first<{ id: number; kind: ReactionKind }>();

    if (!existing) {
      await d
        .prepare("INSERT INTO reactions (post_id, user_id, kind) VALUES (?, ?, ?)")
        .bind(postId, userId, kind)
        .run();
      return kind;
    }

    if (existing.kind === kind) {
      await d.prepare("DELETE FROM reactions WHERE id = ?").bind(existing.id).run();
      return null;
    }

    await d.prepare("UPDATE reactions SET kind = ? WHERE id = ?").bind(kind, existing.id).run();
    return kind;
  });
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}
