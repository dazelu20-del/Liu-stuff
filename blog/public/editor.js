(function () {
  const form = document.getElementById("post-editor-form");
  const blocksEl = document.getElementById("editor-blocks");
  const hiddenInput = document.getElementById("post-document");
  const initialEl = document.getElementById("initial-document");
  if (!form || !blocksEl || !hiddenInput || !initialEl) return;

  const csrf = form.dataset.csrf || "";
  const sizeSelect = document.querySelector('[data-cmd="size"]');
  const fontSelect = document.querySelector('[data-cmd="font"]');
  let activeTextEl = null;
  let dragBlock = null;

  const SIZE_CLASS = {
    small: "text-small",
    large: "text-large",
    xlarge: "text-xlarge",
    normal: "",
  };

  const FONT_CLASS = {
    serif: "text-font-serif",
    mono: "text-font-mono",
    sans: "",
  };

  function parseInitial() {
    try {
      return JSON.parse(initialEl.textContent || "{}");
    } catch {
      return { v: 1, blocks: [{ type: "text", runs: [{ text: "" }] }] };
    }
  }

  function createBlockShell(type) {
    const shell = document.createElement("div");
    shell.className = "editor-block";
    shell.draggable = true;
    shell.dataset.blockType = type;

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "block-drag-handle";
    handle.setAttribute("aria-label", "Drag to reorder");
    handle.textContent = "⋮⋮";

    const body = document.createElement("div");
    body.className = "block-body";

    const controls = document.createElement("div");
    controls.className = "block-controls";

    shell.append(handle, body, controls);
    return { shell, body, controls, handle };
  }

  function applyRunStyle(span, run) {
    span.className = "";
    const classes = [];
    if (run.size && run.size !== "normal") classes.push(`text-${run.size}`);
    if (run.font && run.font !== "sans") classes.push(`text-font-${run.font}`);
    if (classes.length) span.className = classes.join(" ");
    let node = span;
    if (run.underline) {
      const u = document.createElement("u");
      u.appendChild(node);
      node = u;
    }
    if (run.italic) {
      const em = document.createElement("em");
      em.appendChild(node);
      node = em;
    }
    if (run.bold) {
      const strong = document.createElement("strong");
      strong.appendChild(node);
      node = strong;
    }
    return node;
  }

  function renderRuns(runs) {
    const frag = document.createDocumentFragment();
    for (const run of runs) {
      const span = document.createElement("span");
      span.textContent = run.text;
      frag.appendChild(applyRunStyle(span, run));
    }
    return frag;
  }

  function createTextBlock(block) {
    const { shell, body } = createBlockShell("text");
    const editor = document.createElement("div");
    editor.className = "text-block-editor";
    editor.contentEditable = "true";
    editor.dataset.align = block.align || "left";
    editor.dataset.size = "normal";
    editor.dataset.font = "sans";
    editor.style.textAlign = editor.dataset.align;
    editor.appendChild(renderRuns(block.runs?.length ? block.runs : [{ text: "" }]));
    body.appendChild(editor);

    editor.addEventListener("focus", () => {
      activeTextEl = editor;
      syncToolbarFromEditor(editor);
    });

    shell.addEventListener("dragstart", onDragStart);
    shell.addEventListener("dragend", onDragEnd);
    shell.addEventListener("dragover", onDragOver);
    shell.addEventListener("drop", onDrop);
    return shell;
  }

  function mediaControls(shell, align, width, onAlign, onWidth) {
    const controls = shell.querySelector(".block-controls");
    controls.innerHTML = "";

    const alignSelect = document.createElement("select");
    alignSelect.className = "block-align-select";
    ["left", "center", "right", "full"].forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      if (value === align) opt.selected = true;
      alignSelect.appendChild(opt);
    });
    alignSelect.addEventListener("change", () => onAlign(alignSelect.value));

    const widthLabel = document.createElement("label");
    widthLabel.className = "block-width-label";
    widthLabel.textContent = "Width";
    const widthRange = document.createElement("input");
    widthRange.type = "range";
    widthRange.min = "20";
    widthRange.max = "100";
    widthRange.value = String(width);
    widthRange.addEventListener("input", () => onWidth(Number(widthRange.value)));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "block-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => shell.remove());

    controls.append(alignSelect, widthLabel, widthRange, removeBtn);
  }

  function createMediaBlock(block) {
    const { shell, body } = createBlockShell("media");
    shell.dataset.mediaId = String(block.id);
    const align = block.align || "center";
    const width = block.width ?? 100;

    const wrap = document.createElement("div");
    wrap.className = `media-block-preview content-align-${align}`;
    wrap.style.width = align === "full" ? "100%" : `${width}%`;

    const img = document.createElement("img");
    img.src = `/media/${block.id}`;
    img.alt = "";
    wrap.appendChild(img);
    body.appendChild(wrap);

    const updateAlign = (value) => {
      wrap.className = `media-block-preview content-align-${value}`;
      wrap.style.width = value === "full" ? "100%" : `${width}%`;
      shell.dataset.align = value;
    };
    const updateWidth = (value) => {
      shell.dataset.width = String(value);
      if (shell.dataset.align !== "full") wrap.style.width = `${value}%`;
    };

    shell.dataset.align = align;
    shell.dataset.width = String(width);
    mediaControls(shell, align, width, updateAlign, updateWidth);

    shell.addEventListener("dragstart", onDragStart);
    shell.addEventListener("dragend", onDragEnd);
    shell.addEventListener("dragover", onDragOver);
    shell.addEventListener("drop", onDrop);
    return shell;
  }

  function renderBlocks(doc) {
    blocksEl.innerHTML = "";
    for (const block of doc.blocks || []) {
      if (block.type === "media") {
        blocksEl.appendChild(createMediaBlock(block));
      } else {
        blocksEl.appendChild(createTextBlock(block));
      }
    }
    if (!blocksEl.children.length) {
      blocksEl.appendChild(createTextBlock({ type: "text", runs: [{ text: "" }] }));
    }
  }

  function onDragStart(event) {
    dragBlock = event.currentTarget;
    event.dataTransfer.effectAllowed = "move";
    dragBlock.classList.add("dragging");
  }

  function onDragEnd() {
    if (dragBlock) dragBlock.classList.remove("dragging");
    dragBlock = null;
  }

  function onDragOver(event) {
    event.preventDefault();
    const target = event.currentTarget;
    if (!dragBlock || target === dragBlock) return;
    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    if (before) {
      blocksEl.insertBefore(dragBlock, target);
    } else {
      blocksEl.insertBefore(dragBlock, target.nextSibling);
    }
  }

  function onDrop(event) {
    event.preventDefault();
  }

  function collectStyle(node, style) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        style.runs.push({
          text,
          bold: style.bold,
          italic: style.italic,
          underline: style.underline,
          size: style.size,
          font: style.font,
        });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node;
    const next = { ...style, runs: [] };
    if (el.tagName === "STRONG" || el.tagName === "B") next.bold = true;
    if (el.tagName === "EM" || el.tagName === "I") next.italic = true;
    if (el.tagName === "U") next.underline = true;
    if (el.classList.contains("text-small")) next.size = "small";
    if (el.classList.contains("text-large")) next.size = "large";
    if (el.classList.contains("text-xlarge")) next.size = "xlarge";
    if (el.classList.contains("text-font-serif")) next.font = "serif";
    if (el.classList.contains("text-font-mono")) next.font = "mono";
    if (el.tagName === "BR") {
      next.runs.push({ text: "\n", ...pickStyle(next) });
      return;
    }
    for (const child of el.childNodes) {
      collectStyle(child, next);
    }
    style.runs.push(...next.runs);
  }

  function pickStyle(style) {
    return {
      bold: style.bold || false,
      italic: style.italic || false,
      underline: style.underline || false,
      size: style.size || "normal",
      font: style.font || "sans",
    };
  }

  function serializeTextBlock(el) {
    const runs = [];
    const baseStyle = {
      bold: false,
      italic: false,
      underline: false,
      size: el.dataset.size || "normal",
      font: el.dataset.font || "sans",
    };
    for (const child of el.childNodes) {
      const chunk = { ...baseStyle, runs: [] };
      collectStyle(child, chunk);
      runs.push(...chunk.runs);
    }
    const cleaned = runs
      .map((run) => {
        const out = { text: run.text };
        if (run.bold) out.bold = true;
        if (run.italic) out.italic = true;
        if (run.underline) out.underline = true;
        if (run.size && run.size !== "normal") out.size = run.size;
        if (run.font && run.font !== "sans") out.font = run.font;
        return out;
      })
      .filter((run) => run.text.length > 0);
    return {
      type: "text",
      align: el.dataset.align || "left",
      runs: cleaned.length ? cleaned : [{ text: el.textContent || "" }],
    };
  }

  function serializeDocument() {
    const blocks = [];
    for (const shell of blocksEl.querySelectorAll(".editor-block")) {
      if (shell.dataset.blockType === "media") {
        blocks.push({
          type: "media",
          id: Number(shell.dataset.mediaId),
          align: shell.dataset.align || "center",
          width: Number(shell.dataset.width || 100),
        });
      } else {
        const editor = shell.querySelector(".text-block-editor");
        if (editor) blocks.push(serializeTextBlock(editor));
      }
    }
    return { v: 1, blocks };
  }

  function syncToolbarFromEditor(editor) {
    if (sizeSelect) sizeSelect.value = editor.dataset.size || "normal";
    if (fontSelect) fontSelect.value = editor.dataset.font || "sans";
  }

  function getActiveRange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !activeTextEl) return null;
    const range = selection.getRangeAt(0);
    if (!activeTextEl.contains(range.commonAncestorContainer)) return null;
    return { selection, range };
  }

  function wrapSelectionWithClass(className) {
    const ctx = getActiveRange();
    if (!ctx || ctx.range.collapsed) return false;
    const span = document.createElement("span");
    if (className) span.className = className;
    try {
      ctx.range.surroundContents(span);
    } catch {
      const contents = ctx.range.extractContents();
      span.appendChild(contents);
      ctx.range.insertNode(span);
    }
    ctx.selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    newRange.collapse(false);
    ctx.selection.addRange(newRange);
    return true;
  }

  function applySize(size) {
    if (!activeTextEl) return;
    activeTextEl.dataset.size = size;
    const className = SIZE_CLASS[size] || "";
    const ctx = getActiveRange();
    if (ctx && !ctx.range.collapsed && className) {
      wrapSelectionWithClass(className);
    }
    if (sizeSelect) sizeSelect.value = size;
  }

  function applyFont(font) {
    if (!activeTextEl) return;
    activeTextEl.dataset.font = font;
    const className = FONT_CLASS[font] || "";
    const ctx = getActiveRange();
    if (ctx && !ctx.range.collapsed) {
      if (className) {
        wrapSelectionWithClass(className);
      }
    }
    if (fontSelect) fontSelect.value = font;
  }

  function setBlockAlign(align) {
    if (!activeTextEl) return;
    activeTextEl.dataset.align = align;
    activeTextEl.style.textAlign = align;
  }

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    return data;
  }

  async function insertMedia(file) {
    const result = await uploadFile(file);
    const block = createMediaBlock({
      type: "media",
      id: result.id,
      align: "center",
      width: 80,
    });
    blocksEl.appendChild(block);
  }

  document.querySelector(".editor-toolbar")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-cmd]");
    if (!btn || btn.tagName === "SELECT") return;
    const cmd = btn.dataset.cmd;
    if (cmd === "bold") document.execCommand("bold");
    if (cmd === "italic") document.execCommand("italic");
    if (cmd === "underline") document.execCommand("underline");
    if (cmd === "align-left") setBlockAlign("left");
    if (cmd === "align-center") setBlockAlign("center");
    if (cmd === "align-right") setBlockAlign("right");
    if (cmd === "add-text") {
      blocksEl.appendChild(createTextBlock({ type: "text", runs: [{ text: "" }] }));
    }
  });

  document.querySelector(".editor-toolbar")?.addEventListener("change", (event) => {
    const select = event.target.closest("[data-cmd]");
    if (!select) return;
    if (select.dataset.cmd === "size") applySize(select.value);
    if (select.dataset.cmd === "font") applyFont(select.value);
  });

  document.querySelectorAll("[data-upload]").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        await insertMedia(file);
      } catch (err) {
        alert(err.message || "Upload failed.");
      }
    });
  });

  blocksEl.addEventListener("dragover", (event) => {
    if (!dragBlock) return;
    event.preventDefault();
    const after = getDragAfterElement(blocksEl, event.clientY);
    if (after == null) {
      blocksEl.appendChild(dragBlock);
    } else {
      blocksEl.insertBefore(dragBlock, after);
    }
  });

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll(".editor-block:not(.dragging)")];
    return elements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  form.addEventListener("submit", () => {
    hiddenInput.value = JSON.stringify(serializeDocument());
  });

  renderBlocks(parseInitial());
})();
