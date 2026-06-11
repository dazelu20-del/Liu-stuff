import { Hono, type Context } from "hono";
import type { Env, SessionData } from "./types";
import {
  createSession,
  getSecret,
  hashPassword,
  randomToken,
  clearSessionCookie,
  sessionCookie,
  signSession,
  validateCsrf,
  verifyPassword,
} from "./crypto";
import {
  createComment,
  createPost,
  createUser,
  deletePost,
  findUserByEmail,
  findUserByUsername,
  getPost,
  getReactionCounts,
  getUserReaction,
  isUniqueViolation,
  listComments,
  listPosts,
  searchPosts,
  toggleReaction,
  updatePost,
} from "./models";
import {
  renderGuestLoginPage,
  renderGuestSignupPage,
  renderHome,
  renderPostForm,
  renderPostPage,
  renderSearch,
} from "./html";
import { getSession, requireCsrf, requireLogin, requireLoginJson } from "./middleware";
import {
  respondHtml,
  jsonError,
  safeRedirectTarget,
  withSecurityHeaders,
} from "./security";
import {
  normalizeSearchQuery,
  validateBody,
  validateComment,
  validateEmail,
  validatePassword,
  validateReactionKind,
  validateTitle,
  validateUsername,
} from "./validation";
import { isSecureRequest } from "./util";

const app = new Hono<{ Bindings: Env; Variables: { session?: SessionData; parsedBody?: Record<string, string | File> } }>();

async function ensureGuestSession(c: Context<{ Bindings: Env }>): Promise<SessionData> {
  const existing = await getSession(c);
  if (existing) return existing;
  const csrfToken = randomToken(16);
  const guest: SessionData = { userId: 0, username: "", csrfToken };
  const token = await signSession(guest, getSecret(c.env));
  c.header(
    "Set-Cookie",
    sessionCookie(token, isSecureRequest(new URL(c.req.url)), 60 * 60 * 24)
  );
  return guest;
}

async function setUserSession(
  c: Context<{ Bindings: Env }>,
  userId: number,
  username: string
) {
  const { token } = await createSession(userId, username, getSecret(c.env));
  c.header(
    "Set-Cookie",
    sessionCookie(token, isSecureRequest(new URL(c.req.url)))
  );
}

app.get("/", async (c) => {
  const posts = await listPosts(c.env.DB);
  const session = await getSession(c);
  return respondHtml(c,renderHome(posts, session?.userId ? session : null));
});

app.get("/signup", async (c) => {
  const guest = await ensureGuestSession(c);
  return respondHtml(c,renderGuestSignupPage(guest.csrfToken));
});

app.post("/signup", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  const body = c.get("parsedBody") as Record<string, string | File>;
  const username = String(body.username ?? "");
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const errors: string[] = [];
  const userErr = validateUsername(username);
  const emailErr = validateEmail(email);
  const passErr = validatePassword(password);
  if (userErr) errors.push(userErr);
  if (emailErr) errors.push(emailErr);
  if (passErr) errors.push(passErr);

  if (errors.length === 0) {
    const existingUser = await findUserByUsername(c.env.DB, username);
    if (existingUser) errors.push("That username is already taken.");
    const existingEmail = await findUserByEmail(c.env.DB, email);
    if (existingEmail) errors.push("That email is already registered.");
  }

  if (errors.length > 0) {
    const guest = await ensureGuestSession(c);
    return respondHtml(c,
      renderGuestSignupPage(guest.csrfToken).replace(
        "<h1>Sign up</h1>",
        `<h1>Sign up</h1><ul class="errors">${errors.map((e) => `<li>${e}</li>`).join("")}</ul>`
      ),
      400
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    await createUser(c.env.DB, username, email, passwordHash);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const guest = await ensureGuestSession(c);
      return respondHtml(c,renderGuestSignupPage(guest.csrfToken), 400);
    }
    throw err;
  }

  return c.redirect("/login", 302);
});

app.get("/login", async (c) => {
  const guest = await ensureGuestSession(c);
  const next = c.req.query("next") ?? "";
  return respondHtml(c,renderGuestLoginPage(next, guest.csrfToken));
});

app.post("/login", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  const body = c.get("parsedBody") as Record<string, string | File>;
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const next = safeRedirectTarget(String(body.next ?? c.req.query("next") ?? ""));

  const user = await findUserByUsername(c.env.DB, username);
  const valid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !valid) {
    const guest = await ensureGuestSession(c);
    return respondHtml(c,
      renderGuestLoginPage(next, guest.csrfToken).replace(
        "<h1>Log in</h1>",
        `<h1>Log in</h1><ul class="errors"><li>Invalid username or password.</li></ul>`
      ),
      400
    );
  }

  await setUserSession(c, user.id, user.username);
  return c.redirect(next, 302);
});

app.post("/logout", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  c.header("Set-Cookie", clearSessionCookie(isSecureRequest(new URL(c.req.url))));
  return c.redirect("/", 302);
});

app.get("/new", async (c) => {
  const session = await requireLogin(c);
  if (session instanceof Response) return session;
  return respondHtml(c,renderPostForm("new", session));
});

app.post("/new", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  const session = await requireLogin(c);
  if (session instanceof Response) return session;
  const body = c.get("parsedBody") as Record<string, string | File>;
  const title = String(body.title ?? "");
  const postBody = String(body.body ?? "");
  const errors = [validateTitle(title), validateBody(postBody)].filter(Boolean) as string[];
  if (errors.length) return respondHtml(c,renderPostForm("new", session, undefined, errors), 400);
  const id = await createPost(c.env.DB, session.userId, title.trim(), postBody.trim());
  return c.redirect(`/post/${id}`, 302);
});

app.get("/edit/:id", async (c) => {
  const session = await requireLogin(c);
  if (session instanceof Response) return session;
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c,"<p>Not found</p>", 404);
  if (post.author_id !== session.userId) return respondHtml(c,"<p>Forbidden</p>", 403);
  return respondHtml(c,renderPostForm("edit", session, post));
});

app.post("/edit/:id", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  const session = await requireLogin(c);
  if (session instanceof Response) return session;
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c,"<p>Not found</p>", 404);
  if (post.author_id !== session.userId) return respondHtml(c,"<p>Forbidden</p>", 403);
  const body = c.get("parsedBody") as Record<string, string | File>;
  const title = String(body.title ?? "");
  const postBody = String(body.body ?? "");
  const errors = [validateTitle(title), validateBody(postBody)].filter(Boolean) as string[];
  if (errors.length) return respondHtml(c,renderPostForm("edit", session, post, errors), 400);
  await updatePost(c.env.DB, id, session.userId, title.trim(), postBody.trim());
  return c.redirect(`/post/${id}`, 302);
});

app.post("/delete/:id", async (c) => {
  const csrfFail = await requireCsrf(c, false);
  if (csrfFail) return csrfFail;
  const session = await requireLogin(c);
  if (session instanceof Response) return session;
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c,"<p>Not found</p>", 404);
  if (post.author_id !== session.userId) return respondHtml(c,"<p>Forbidden</p>", 403);
  await deletePost(c.env.DB, id, session.userId);
  return c.redirect("/", 302);
});

app.get("/post/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c,"<p>Not found</p>", 404);
  const comments = await listComments(c.env.DB, id);
  const counts = await getReactionCounts(c.env.DB, id);
  const session = await getSession(c);
  const userReaction = session?.userId ? await getUserReaction(c.env.DB, id, session.userId) : null;
  return respondHtml(c,
    renderPostPage(post, comments, counts, userReaction, session?.userId ? session : null)
  );
});

app.get("/search", async (c) => {
  const raw = c.req.query("q");
  const query = normalizeSearchQuery(raw);
  const session = await getSession(c);
  if (!query) {
    return respondHtml(c,renderSearch("", [], session?.userId ? session : null, true));
  }
  const posts = await searchPosts(c.env.DB, query);
  return respondHtml(c,renderSearch(query, posts, session?.userId ? session : null, false));
});

app.post("/api/post/:id/comment", async (c) => {
  const sessionRaw = await getSession(c);
  const token = c.req.header("X-CSRF-Token");
  if (!validateCsrf(sessionRaw, token)) {
    return jsonError("Invalid or missing CSRF token.", 400);
  }
  const session = await requireLoginJson(c);
  if (session instanceof Response) return session;
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return jsonError("Post not found.", 404);
  let payload: { body?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return jsonError("Comment must be text.", 400);
  }
  const commentErr = validateComment(payload.body);
  if (commentErr) return jsonError(commentErr, 400);
  const comment = await createComment(c.env.DB, id, session.userId, String(payload.body).trim());
  return withSecurityHeaders(
    Response.json(
      {
        ok: true,
        comment: {
          id: comment.id,
          post_id: comment.post_id,
          body: comment.body,
          created_at: comment.created_at,
          author: comment.author,
        },
      },
      { status: 201 }
    )
  );
});

app.post("/api/post/:id/react", async (c) => {
  const sessionRaw = await getSession(c);
  const token = c.req.header("X-CSRF-Token");
  if (!validateCsrf(sessionRaw, token)) {
    return jsonError("Invalid or missing CSRF token.", 400);
  }
  const session = await requireLoginJson(c);
  if (session instanceof Response) return session;
  const id = Number(c.req.param("id"));
  const post = await getPost(c.env.DB, id);
  if (!post) return jsonError("Post not found.", 404);
  let payload: { kind?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return jsonError("Reaction must be 'like' or 'dislike'.", 400);
  }
  const kindErr = validateReactionKind(payload.kind);
  if (kindErr) return jsonError(kindErr, 400);
  const reaction = await toggleReaction(c.env.DB, id, session.userId, payload.kind as "like" | "dislike");
  const counts = await getReactionCounts(c.env.DB, id);
  return withSecurityHeaders(
    Response.json({ ok: true, reaction, counts })
  );
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
