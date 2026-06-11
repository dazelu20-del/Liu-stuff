(function () {
  const storageKey = "blog-theme";
  const root = document.documentElement;

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
  }

  function currentTheme() {
    return localStorage.getItem(storageKey) || systemTheme();
  }

  applyTheme(currentTheme());

  document.addEventListener("DOMContentLoaded", function () {
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        localStorage.setItem(storageKey, next);
        applyTheme(next);
      });
    }
  });
})();
