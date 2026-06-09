function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (!toggle || !navLinks) return;

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen);
  });
}

function renderFeatured(post) {
  const container = document.getElementById("featured-post");
  if (!container || !post) return;

  container.innerHTML = `
    <a href="${getPostUrl(post.id)}" class="featured-card">
      <div class="featured-image" data-color="${post.color}"></div>
      <div class="featured-body">
        <span class="tag">${post.tag}</span>
        <h2>${post.title}</h2>
        <p class="featured-meta">${formatDate(post.date)} · ${post.author}</p>
        <p class="featured-excerpt">${post.excerpt}</p>
        <span class="read-more">Leggi l'articolo →</span>
      </div>
    </a>
  `;
}

function renderPostCard(post) {
  return `
    <article class="post-card">
      <a href="${getPostUrl(post.id)}">
        <div class="post-card-image" data-color="${post.color}"></div>
      </a>
      <div class="post-card-body">
        <span class="tag">${post.tag}</span>
        <h3><a href="${getPostUrl(post.id)}">${post.title}</a></h3>
        <p class="post-meta">${formatDate(post.date)} · ${post.author}</p>
        <p class="post-excerpt">${post.excerpt}</p>
      </div>
    </article>
  `;
}

function renderPostsGrid(posts) {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;

  if (posts.length === 0) {
    grid.innerHTML = `<p class="error-msg">Nessun articolo trovato per questa categoria.</p>`;
    return;
  }

  grid.innerHTML = posts.map(renderPostCard).join("");
}

function renderFilterTags(activeTag) {
  const container = document.getElementById("filter-tags");
  if (!container) return;

  container.innerHTML = TAGS.map(tag => `
    <button class="filter-btn ${tag === activeTag ? "active" : ""}" data-tag="${tag}">
      ${tag}
    </button>
  `).join("");

  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      const filtered = tag === "Tutti" ? POSTS : POSTS.filter(p => p.tag === tag);
      renderFilterTags(tag);
      renderPostsGrid(filtered);
    });
  });
}

function initHomePage() {
  if (!document.getElementById("posts-grid")) return;

  const featured = POSTS[0];
  const rest = POSTS.slice(1);

  renderFeatured(featured);
  renderFilterTags("Tutti");
  renderPostsGrid(rest);
}

initNav();
initHomePage();
