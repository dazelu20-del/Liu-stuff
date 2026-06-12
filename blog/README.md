# Liu Stuff Blog (Cloudflare Workers + D1)

Full-stack personal blog from `task-11.md`: accounts, posts, comments, reactions, search, light/dark theme.

## Stack

- **Runtime:** Cloudflare Workers (Hono)
- **Database:** D1 (SQLite)
- **Static assets:** `public/` (CSS, JS)

## Local development

```bash
cd blog
npm install
npx wrangler d1 execute liu-stuff-blog-db --local --file=schema.sql -y
npm run dev
```

## Tests

```bash
npm test
```

## Deploy (Cloudflare free plan)

See `../SKILL.md` for the full runbook. Quick version:

```bash
cd blog
npm install
npx wrangler login
npx wrangler d1 create liu-stuff-blog-db   # paste database_id into wrangler.jsonc
npx wrangler d1 execute liu-stuff-blog-db --remote --file=schema.sql -y
npx wrangler deploy
openssl rand -hex 32 | npx wrangler secret put SECRET_KEY
```

Live URL: `https://liu-stuff-blog.dazelu20.workers.dev`

## Rich post editor

- WYSIWYG editor with a 3-row toolbar (like a classic rich text editor)
- Bold, italic, underline, strikethrough, fonts, sizes, text & highlight colors
- Headings, alignment, bullet/numbered lists, indent, links, images
- HTML source view, fullscreen, undo/redo
- Image uploads (JPEG, PNG, WebP up to 2 MB), stored in D1 — no R2 required

## Features (task-11 contract)

- Sign up / log in / log out (username, case-insensitive)
- Posts CRUD (author-only edit/delete)
- Comments and like/dislike reactions (JSON API)
- Case-insensitive search with escaped wildcards
- CSRF on every POST
- Light/dark theme in `localStorage`
- Security headers on every response
