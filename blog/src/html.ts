import { editorInitialPayload, renderPostBodyHtml } from "./content";
import { escapeHtml, truncatePreview } from "./util";
import type { Comment, Post, SessionData } from "./types";

function nav(session: SessionData | null): string {
  const authLinks = session
    ? `<span class="nav-user">Hi, ${escapeHtml(session.username)}</span>
       <a href="/new">New post</a>
       <form class="inline-form" method="post" action="/logout">
         <input type="hidden" name="csrf_token" value="${escapeHtml(session.csrfToken)}" />
         <button type="submit" class="btn-link">Log out</button>
       </form>`
    : `<a href="/login">Log in</a><a href="/signup" class="btn btn-primary">Sign up</a>`;

  return `<header class="site-header">
    <div class="container nav">
      <a href="/" class="logo">Blog</a>
      <nav class="nav-links">
        <a href="/">Home</a>
        <a href="/search">Search</a>
        ${authLinks}
      </nav>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme">Theme</button>
    </div>
  </header>`;
}

function layout(title: string, body: string, session: SessionData | null): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/style.css?v=13" />
  <script src="/theme.js" defer></script>
</head>
<body>
  ${nav(session)}
  <main class="container page">${body}</main>
  <footer class="site-footer"><div class="container">Built with Cloudflare Workers + D1</div></footer>
</body>
</html>`;
}

export function renderHome(posts: Post[], session: SessionData | null): string {
  const list =
    posts.length === 0
      ? `<p class="empty-state">No posts yet. Be the first to write one!</p>`
      : `<div class="post-list">${posts.map(renderPostCard).join("")}</div>`;

  return layout("Home", `<section><h1>Latest posts</h1>${list}</section>`, session);
}

function renderPostCard(post: Post): string {
  return `<article class="post-card">
    <h2><a href="/post/${post.id}">${escapeHtml(post.title)}</a></h2>
    <p class="post-meta">By ${escapeHtml(post.author ?? "unknown")} · ${escapeHtml(post.created_at)}</p>
    <p class="post-preview">${escapeHtml(truncatePreview(post.body, 150, true))}</p>
    <a class="read-more" href="/post/${post.id}">Read more →</a>
  </article>`;
}

export function renderPostPage(
  post: Post,
  comments: Comment[],
  counts: { like: number; dislike: number },
  userReaction: string | null,
  session: SessionData | null
): string {
  const edited = post.updated_at ? `<span class="edited">(edited)</span>` : "";
  const commentList =
    comments.length === 0
      ? `<p class="empty-state">No comments yet.</p>`
      : `<ul class="comment-list">${comments
          .map(
            (c) => `<li class="comment">
              <p class="comment-meta">${escapeHtml(c.author ?? "unknown")} · ${escapeHtml(c.created_at)}</p>
              <p class="comment-body">${escapeHtml(c.body)}</p>
            </li>`
          )
          .join("")}</ul>`;

  const reactionBlock = session
    ? `<div class="reactions" id="reactions" data-post-id="${post.id}" data-csrf="${escapeHtml(session.csrfToken)}">
         <button type="button" class="react-btn ${userReaction === "like" ? "active" : ""}" data-kind="like">👍 <span id="like-count">${counts.like}</span></button>
         <button type="button" class="react-btn ${userReaction === "dislike" ? "active" : ""}" data-kind="dislike">👎 <span id="dislike-count">${counts.dislike}</span></button>
       </div>
       <form id="comment-form" class="comment-form" data-post-id="${post.id}" data-csrf="${escapeHtml(session.csrfToken)}">
         <label for="comment-body">Add a comment</label>
         <textarea id="comment-body" name="body" maxlength="2000" required></textarea>
         <button type="submit" class="btn btn-primary">Post comment</button>
       </form>`
    : `<div class="reactions">
         <span class="react-btn">👍 ${counts.like}</span>
         <span class="react-btn">👎 ${counts.dislike}</span>
       </div>
       <p class="hint"><a href="/login?next=${encodeURIComponent(`/post/${post.id}`)}">Log in</a> to comment or react.</p>`;

  const authorActions =
    session && session.userId === post.author_id
      ? `<div class="post-actions">
           <a href="/edit/${post.id}" class="btn">Edit</a>
           <form method="post" action="/delete/${post.id}" class="inline-form delete-form">
             <input type="hidden" name="csrf_token" value="${escapeHtml(session.csrfToken)}" />
             <button type="submit" class="btn btn-danger">Delete</button>
           </form>
         </div>`
      : "";

  return layout(
    post.title,
    `<article class="post-detail">
      <h1>${escapeHtml(post.title)} ${edited}</h1>
      <p class="post-meta">By ${escapeHtml(post.author ?? "unknown")} · ${escapeHtml(post.created_at)}</p>
      ${authorActions}
      <div class="post-body">${renderPostBodyHtml(post.body)}</div>
      ${reactionBlock}
      <section class="comments"><h2>Comments</h2>${commentList}</section>
    </article>
    <script src="/post.js" defer></script>`,
    session
  );
}

export function renderAuthForm(
  kind: "login" | "signup",
  session: SessionData | null,
  errors: string[],
  values: Record<string, string> = {},
  next = ""
): string {
  const csrf = session?.csrfToken ?? values.csrf_token ?? "";
  const errorBlock =
    errors.length > 0
      ? `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

  if (kind === "signup") {
    return layout(
      "Sign up",
      `<section class="form-page">
        <h1>Sign up</h1>
        ${errorBlock}
        <form method="post" action="/signup" class="form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrf)}" />
          <label>Username<input name="username" value="${escapeHtml(values.username ?? "")}" required /></label>
          <label>Email<input name="email" type="email" value="${escapeHtml(values.email ?? "")}" required /></label>
          <label>Password<input name="password" type="password" required /></label>
          <button type="submit" class="btn btn-primary">Create account</button>
        </form>
      </section>`,
      session
    );
  }

  const nextField = next ? `<input type="hidden" name="next" value="${escapeHtml(next)}" />` : "";
  return layout(
    "Log in",
    `<section class="form-page">
      <h1>Log in</h1>
      ${errorBlock}
      <form method="post" action="/login${next ? `?next=${encodeURIComponent(next)}` : ""}" class="form">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrf)}" />
        ${nextField}
        <label>Username<input name="username" value="${escapeHtml(values.username ?? "")}" required /></label>
        <label>Password<input name="password" type="password" required /></label>
        <button type="submit" class="btn btn-primary">Log in</button>
      </form>
    </section>`,
    session
  );
}

function editorLayout(title: string, body: string, session: SessionData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/style.css?v=13" />
  <link rel="stylesheet" href="/rich-editor.css?v=13" />
  <script src="/theme.js" defer></script>
</head>
<body>
  ${nav(session)}
  <main class="container page editor-page">${body}</main>
  <footer class="site-footer"><div class="container">Built with Cloudflare Workers + D1</div></footer>
  <script src="/rich-editor.js?v=13" defer></script>
</body>
</html>`;
}

export function renderPostForm(
  mode: "new" | "edit",
  session: SessionData,
  post?: Post,
  errors: string[] = []
): string {
  const action = mode === "new" ? "/new" : `/edit/${post!.id}`;
  const errorBlock =
    errors.length > 0
      ? `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

  const initialPayload = escapeHtml(JSON.stringify(editorInitialPayload(post?.body ?? "")));

  return editorLayout(
    mode === "new" ? "New post" : "Edit post",
    `<section class="form-page post-editor-section">
      <h1>${mode === "new" ? "New post" : "Edit post"}</h1>
      <p class="hint">Write your post body below. Add an optional image that appears beside the text when published.</p>
      ${errorBlock}
      <form method="post" action="${action}" class="form post-editor-form" id="post-editor-form"
            data-csrf="${escapeHtml(session.csrfToken)}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(session.csrfToken)}" />
        <label>Title<input name="title" maxlength="200" value="${escapeHtml(post?.title ?? "")}" required /></label>

        <div class="editor-body-field">
          <span class="editor-body-label">Body</span>
          <div class="rte" id="rich-editor">
            <div class="rte-toolbar" role="toolbar" aria-label="Formatting">
              <div class="rte-row">
                <button type="button" class="rte-btn" data-cmd="bold" title="Bold"><strong>B</strong></button>
                <button type="button" class="rte-btn" data-cmd="italic" title="Italic"><em>I</em></button>
                <button type="button" class="rte-btn" data-cmd="underline" title="Underline"><u>U</u></button>
                <button type="button" class="rte-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
                <select class="rte-select" data-cmd="fontName" title="Font">
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Arial">Arial</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                </select>
                <select class="rte-select" data-cmd="fontSize" title="Font size">
                  <option value="2">10 pt</option>
                  <option value="3" selected>12 pt</option>
                  <option value="4">14 pt</option>
                  <option value="5">16 pt</option>
                  <option value="6">18 pt</option>
                  <option value="7">24 pt</option>
                </select>
                <div class="rte-color-wrap" id="rte-color-wrap">
                  <button type="button" class="rte-color-trigger" id="rte-color-trigger" title="Text color">
                    <span class="rte-color-letter">A</span>
                    <span class="rte-color-underline" id="rte-color-underline"></span>
                  </button>
                  <div class="rte-color-menu" id="rte-color-menu" hidden>
                    <div class="rte-color-swatches" id="rte-color-swatches"></div>
                    <label class="rte-color-custom-label">
                      Custom
                      <input type="color" id="rte-color-custom" value="#1a1a1a" />
                    </label>
                  </div>
                </div>
              </div>
              <div class="rte-row">
                <select class="rte-select rte-select-wide" data-cmd="formatBlock" title="Paragraph format">
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                <select class="rte-select" data-cmd="justify" title="Alignment">
                  <option value="left">Align left</option>
                  <option value="center">Align center</option>
                  <option value="right">Align right</option>
                  <option value="full">Justify</option>
                </select>
                <button type="button" class="rte-btn" data-cmd="insertOrderedList" title="Numbered list">1.</button>
                <button type="button" class="rte-btn" data-cmd="insertUnorderedList" title="Bullet list">•</button>
                <button type="button" class="rte-btn" data-cmd="outdent" title="Decrease indent">⇤</button>
                <button type="button" class="rte-btn" data-cmd="indent" title="Increase indent">⇥</button>
                <button type="button" class="rte-btn" data-cmd="createLink" title="Link selected text">Link</button>
              </div>
              <div class="rte-row">
                <button type="button" class="rte-btn" data-cmd="code" title="HTML source">&lt;/&gt;</button>
                <button type="button" class="rte-btn" data-cmd="fullscreen" title="Fullscreen">⛶</button>
                <button type="button" class="rte-btn" data-cmd="undo" title="Undo">↶</button>
                <button type="button" class="rte-btn" data-cmd="redo" title="Redo">↷</button>
              </div>
            </div>
            <div id="rte-body" class="rte-content" contenteditable="true" aria-label="Post body"></div>
            <textarea id="rte-source" class="rte-source" hidden aria-label="HTML source"></textarea>
          </div>
        </div>

        <div class="post-image-field">
          <span class="editor-body-label">Post images (optional)</span>
          <p class="hint post-image-hint">Separate from the body. Use L/R on each image to place it left or right of your text.</p>
          <div class="post-image-panel" id="post-image-panel">
            <div class="post-image-gallery" id="post-image-gallery" aria-live="polite"></div>
            <input type="file" id="post-image-input" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden />
          </div>
        </div>

        <textarea id="initial-document" class="rte-initial-data" hidden aria-hidden="true">${initialPayload}</textarea>
        <input type="hidden" name="body" id="post-document" value="${initialPayload}" />
        <div class="editor-actions">
          <button type="submit" class="btn btn-primary">Publish</button>
        </div>
      </form>
    </section>`,
    session
  );
}

export function renderSearch(
  query: string,
  posts: Post[],
  session: SessionData | null,
  showPrompt: boolean
): string {
  const results = showPrompt
    ? `<p class="empty-state">Enter a search term to find posts.</p>`
    : posts.length === 0
      ? `<p class="empty-state">No posts matched your search.</p>`
      : `<div class="post-list">${posts.map(renderPostCard).join("")}</div>`;

  return layout(
    "Search",
    `<section>
      <h1>Search</h1>
      <form method="get" action="/search" class="search-form">
        <label for="q">Search posts</label>
        <input id="q" name="q" value="${escapeHtml(query)}" maxlength="100" />
        <button type="submit" class="btn btn-primary">Search</button>
      </form>
      ${results}
    </section>`,
    session
  );
}

export function renderGuestLoginPage(next: string, csrfToken: string): string {
  return renderAuthForm("login", { userId: 0, username: "", csrfToken }, [], {}, next);
}

export function renderGuestSignupPage(csrfToken: string): string {
  return renderAuthForm("signup", { userId: 0, username: "", csrfToken }, [], { csrf_token: csrfToken });
}
