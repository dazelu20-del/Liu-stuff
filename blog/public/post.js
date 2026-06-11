document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".delete-form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!window.confirm("Delete this post?")) {
        event.preventDefault();
      }
    });
  });

  const reactions = document.getElementById("reactions");
  if (reactions) {
    const postId = reactions.dataset.postId;
    const csrf = reactions.dataset.csrf;
    reactions.querySelectorAll(".react-btn[data-kind]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const kind = btn.dataset.kind;
        const response = await fetch("/api/post/" + postId + "/react", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf,
          },
          body: JSON.stringify({ kind: kind }),
        });
        const data = await response.json();
        if (!data.ok) return;
        document.getElementById("like-count").textContent = String(data.counts.like);
        document.getElementById("dislike-count").textContent = String(data.counts.dislike);
        reactions.querySelectorAll(".react-btn[data-kind]").forEach(function (el) {
          el.classList.toggle("active", data.reaction === el.dataset.kind);
        });
      });
    });
  }

  const commentForm = document.getElementById("comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const postId = commentForm.dataset.postId;
      const csrf = commentForm.dataset.csrf;
      const bodyField = document.getElementById("comment-body");
      const body = bodyField.value;
      const response = await fetch("/api/post/" + postId + "/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ body: body }),
      });
      const data = await response.json();
      if (!data.ok) {
        alert(data.error);
        return;
      }
      const list = document.querySelector(".comment-list") || document.createElement("ul");
      if (!list.classList.contains("comment-list")) {
        list.className = "comment-list";
        const section = document.querySelector(".comments");
        const empty = section.querySelector(".empty-state");
        if (empty) empty.remove();
        section.appendChild(list);
      }
      const item = document.createElement("li");
      item.className = "comment";
      const meta = document.createElement("p");
      meta.className = "comment-meta";
      meta.textContent = data.comment.author + " · " + data.comment.created_at;
      const text = document.createElement("p");
      text.className = "comment-body";
      text.textContent = data.comment.body;
      item.appendChild(meta);
      item.appendChild(text);
      list.appendChild(item);
      bodyField.value = "";
    });
  }
});
