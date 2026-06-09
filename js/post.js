function renderPost(post) {
  const container = document.getElementById("post-content");
  if (!container) return;

  document.title = `${post.title} — Notizie & Pensieri`;

  container.innerHTML = `
    <header class="post-header">
      <span class="tag">${post.tag}</span>
      <h1>${post.title}</h1>
      <p class="post-meta">${formatDate(post.date)} · ${post.author}</p>
    </header>
    <div class="post-cover" data-color="${post.color}"></div>
    <div class="post-body">${post.content}</div>
    <a href="index.html" class="back-link">← Torna agli articoli</a>
  `;
}

function renderRelatedPosts(currentPost) {
  const container = document.getElementById("related-posts");
  if (!container) return;

  const related = POSTS
    .filter(p => p.id !== currentPost.id)
    .sort((a, b) => {
      const aMatch = a.tag === currentPost.tag ? 1 : 0;
      const bMatch = b.tag === currentPost.tag ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 3);

  if (related.length === 0) return;

  container.innerHTML = `
    <h2>Altri articoli</h2>
    <div class="related-grid">
      ${related.map(post => `
        <article class="post-card">
          <a href="${getPostUrl(post.id)}">
            <div class="post-card-image" data-color="${post.color}"></div>
          </a>
          <div class="post-card-body">
            <span class="tag">${post.tag}</span>
            <h3><a href="${getPostUrl(post.id)}">${post.title}</a></h3>
            <p class="post-meta">${formatDate(post.date)}</p>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function initPostPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const container = document.getElementById("post-content");

  if (!container) return;

  if (!id) {
    container.innerHTML = `<p class="error-msg">Articolo non trovato. <a href="index.html">Torna alla home</a></p>`;
    return;
  }

  const post = getPostById(id);

  if (!post) {
    container.innerHTML = `<p class="error-msg">Articolo non trovato. <a href="index.html">Torna alla home</a></p>`;
    return;
  }

  renderPost(post);
  renderRelatedPosts(post);
}

function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (!toggle || !navLinks) return;

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen);
  });
}

initNav();
initPostPage();
