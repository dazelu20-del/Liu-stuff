(function () {
  const form = document.getElementById("post-editor-form");
  const editorRoot = document.getElementById("rich-editor");
  const toolbar = editorRoot?.querySelector(".rte-toolbar");
  const bodyEl = document.getElementById("rte-body");
  const sourceEl = document.getElementById("rte-source");
  const hiddenInput = document.getElementById("post-document");
  const initialEl = document.getElementById("initial-document");
  const postImageInput = document.getElementById("post-image-input");
  const postImageGallery = document.getElementById("post-image-gallery");
  const MAX_SIDE_IMAGES = 8;
  const colorTrigger = document.getElementById("rte-color-trigger");
  const colorMenu = document.getElementById("rte-color-menu");
  const colorSwatches = document.getElementById("rte-color-swatches");
  const colorUnderline = document.getElementById("rte-color-underline");
  const colorCustom = document.getElementById("rte-color-custom");

  if (!form || !editorRoot || !toolbar || !bodyEl || !sourceEl || !hiddenInput) return;

  const csrf = form.dataset.csrf || "";
  /** @type {{ id: number, previewUrl?: string }[]} */
  let sideImages = [];
  let sourceMode = false;
  let savedRange = null;
  let typingColor = "#1a1a1a";
  let applyTypingColor = false;
  const typingFormats = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  };

  const FORMAT_CMDS = {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    strikeThrough: "strike",
  };

  const FORMAT_EXEC = {
    bold: "bold",
    italic: "italic",
    underline: "underline",
    strikeThrough: "strikeThrough",
  };

  const FONT_SIZE_MAP = {
    2: "10pt",
    3: "12pt",
    4: "14pt",
    5: "16pt",
    6: "18pt",
    7: "24pt",
  };

  const ALIGN_STYLE_MAP = {
    left: "left",
    center: "center",
    right: "right",
    full: "justify",
  };

  let typingFont = "";
  let typingFontSize = "";
  let typingAlign = "";

  const PALETTE = [
    "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc",
    "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff",
    "#4a86e8", "#0000ff", "#9900ff", "#ff00ff", "#e06666", "#f6b26b",
    "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#8e7cc3", "#c27ba0",
  ];

  function readInitialRaw() {
    const sources = [
      initialEl?.value,
      initialEl?.textContent,
      hiddenInput?.value,
      hiddenInput?.getAttribute("value"),
    ];
    for (const source of sources) {
      const trimmed = (source || "").trim();
      if (trimmed) return trimmed;
    }
    return "{}";
  }

  function stripBodyImages(html) {
    return (html || "")
      .replace(/<div\b[^>]*data-rte-placed-wrap[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div\b[^>]*data-rte-placed-img[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<img\b[^>]*>/gi, "")
      .trim() || "<p><br></p>";
  }

  function loadSideImagesFromPayload(data) {
    sideImages = [];
    const seen = new Set();

    const add = (item) => {
      if (!item || typeof item.id !== "number" || seen.has(item.id)) return;
      seen.add(item.id);
      sideImages.push({
        id: item.id,
        side: item.side === "left" ? "left" : "right",
      });
    };

    if (Array.isArray(data?.sideImages)) {
      for (const item of data.sideImages) add(item);
    }
    add(data?.sideImage);
  }

  function parseInitialDocument() {
    try {
      const data = JSON.parse(readInitialRaw());
      if (data && data.v === 2 && typeof data.html === "string") {
        loadSideImagesFromPayload(data);
        return stripBodyImages(data.html);
      }
      if (data && data.v === 1 && Array.isArray(data.blocks)) {
        const legacyImages = [];
        for (const block of data.blocks) {
          if (block?.type === "media" && block.id) {
            legacyImages.push({ id: block.id, side: "right" });
          }
        }
        loadSideImagesFromPayload({ sideImages: legacyImages });
        return stripBodyImages(bodyFromLegacyBlocks(data.blocks));
      }
    } catch {
      /* fall through */
    }
    return "<p><br></p>";
  }

  function revokePreviewUrl(entry) {
    if (entry?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  }

  function imageSrcForEntry(entry) {
    return entry.previewUrl || `/media/${entry.id}?t=${entry.id}`;
  }

  function setImageSide(id, side) {
    const entry = sideImages.find((item) => item.id === id);
    if (!entry) return;
    entry.side = side === "left" ? "left" : "right";
    renderPostImageGallery();
    syncHiddenDocument(bodyEl.innerHTML);
  }

  function createSideToggle(entry) {
    const wrap = document.createElement("div");
    wrap.className = "post-image-thumb-side";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Image position");

    ["left", "right"].forEach((side) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "post-image-side-btn";
      btn.dataset.side = side;
      btn.textContent = side === "left" ? "L" : "R";
      btn.title = side === "left" ? "Left of text" : "Right of text";
      if (entry.side === side) btn.classList.add("is-active");
      btn.addEventListener("click", () => setImageSide(entry.id, side));
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function renderPostImageGallery() {
    if (!postImageGallery) return;
    postImageGallery.innerHTML = "";

    for (const entry of sideImages) {
      const thumb = document.createElement("div");
      thumb.className = "post-image-thumb";
      thumb.dataset.imageId = String(entry.id);

      const img = document.createElement("img");
      img.alt = "Post image preview";
      img.src = imageSrcForEntry(entry);
      img.addEventListener("error", () => {
        if (!entry.previewUrl) img.src = `/media/${entry.id}`;
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "post-image-thumb-remove";
      removeBtn.title = "Remove image";
      removeBtn.setAttribute("aria-label", "Remove image");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => removeSideImage(entry.id));

      thumb.appendChild(img);
      thumb.appendChild(createSideToggle(entry));
      thumb.appendChild(removeBtn);
      postImageGallery.appendChild(thumb);
    }

    if (sideImages.length < MAX_SIDE_IMAGES) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "post-image-add";
      addBtn.id = "post-image-add";
      addBtn.title = "Add image";
      addBtn.setAttribute("aria-label", "Add image");
      addBtn.textContent = "+";
      addBtn.addEventListener("click", () => postImageInput?.click());
      postImageGallery.appendChild(addBtn);
    }
  }

  function removeSideImage(id) {
    const entry = sideImages.find((item) => item.id === id);
    if (entry) revokePreviewUrl(entry);
    sideImages = sideImages.filter((item) => item.id !== id);
    renderPostImageGallery();
    syncHiddenDocument(bodyEl.innerHTML);
  }

  function bodyFromLegacyBlocks(blocks) {
    const parts = [];
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "text" && Array.isArray(block.runs)) {
        let inner = "";
        for (const run of block.runs) {
          if (!run || typeof run.text !== "string") continue;
          let chunk = run.text;
          if (run.underline) chunk = `<u>${chunk}</u>`;
          if (run.italic) chunk = `<em>${chunk}</em>`;
          if (run.bold) chunk = `<strong>${chunk}</strong>`;
          inner += chunk;
        }
        parts.push(`<p>${inner || "<br>"}</p>`);
      } else if (block.type === "media" && block.id) {
        parts.push(`<img src="/media/${block.id}" alt="Uploaded image" />`);
      }
    }
    return parts.length > 0 ? parts.join("") : "<p><br></p>";
  }

  function buildSideImagesPayload() {
    return sideImages.map((entry) => ({
      id: entry.id,
      side: entry.side === "left" ? "left" : "right",
    }));
  }

  function syncHiddenDocument(html) {
    const doc = { v: 2, html: stripBodyImages(html) };
    const payload = buildSideImagesPayload();
    if (payload.length > 0) doc.sideImages = payload;
    hiddenInput.value = JSON.stringify(doc);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (bodyEl.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }

  function restoreSelection() {
    bodyEl.focus();
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  function exec(cmd, value) {
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value ?? null);
    saveSelection();
  }

  function colorsMatch(a, b) {
    if (!a || !b) return false;
    const probe = document.createElement("span");
    probe.style.color = a;
    const normalizedA = probe.style.color;
    probe.style.color = b;
    return normalizedA === probe.style.color;
  }

  function selectionHasColor(color) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== bodyEl) {
      if (node.nodeType === Node.ELEMENT_NODE && node.style && node.style.color) {
        return colorsMatch(node.style.color, color);
      }
      node = node.parentElement;
    }
    return false;
  }

  function caretHasTag(...tags) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const allowed = new Set(tags.map((tag) => tag.toUpperCase()));
    while (node && node !== bodyEl) {
      if (node.nodeType === Node.ELEMENT_NODE && allowed.has(node.tagName)) return true;
      node = node.parentElement;
    }
    return false;
  }

  function normalizeFontFamily(value) {
    return (value || "").replace(/['"]/g, "").trim().toLowerCase();
  }

  function caretHasStyle(prop, value) {
    if (!value) return true;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    let node = sel.getRangeAt(0).startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const want = prop === "fontFamily"
      ? normalizeFontFamily(value)
      : String(value).trim().toLowerCase();

    while (node && node !== bodyEl) {
      if (node.nodeType === Node.ELEMENT_NODE && node.style) {
        const actual = node.style[prop];
        if (!actual) {
          node = node.parentElement;
          continue;
        }
        if (prop === "fontFamily") {
          if (normalizeFontFamily(actual).includes(want.split(",")[0])) return true;
        } else if (actual.trim().toLowerCase() === want) {
          return true;
        }
      }
      node = node.parentElement;
    }
    return false;
  }

  function getContainingBlock() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== bodyEl) {
      const tag = node.tagName?.toLowerCase();
      if (["p", "h1", "h2", "h3", "div", "blockquote", "li"].includes(tag)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function wrapSelectionStyle(styles) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!bodyEl.contains(range.commonAncestorContainer) || range.collapsed) return;

    const span = document.createElement("span");
    Object.assign(span.style, styles);
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }

    sel.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(span);
    next.collapse(false);
    sel.addRange(next);
    saveSelection();
  }

  function placeCaretAtEnd(el) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    saveSelection();
  }

  function updateFormatButtons() {
    for (const [cmd, key] of Object.entries(FORMAT_CMDS)) {
      const btn = toolbar.querySelector(`[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle("is-active", typingFormats[key]);
    }
  }

  function typingFormatsSatisfied() {
    if (typingFormats.bold && !caretHasTag("STRONG", "B")) return false;
    if (typingFormats.italic && !caretHasTag("EM", "I")) return false;
    if (typingFormats.underline && !caretHasTag("U")) return false;
    if (typingFormats.strike && !caretHasTag("S", "STRIKE", "DEL")) return false;
    if (applyTypingColor && !selectionHasColor(typingColor)) return false;
    if (typingFont && !caretHasStyle("fontFamily", typingFont)) return false;
    if (typingFontSize && !caretHasStyle("fontSize", typingFontSize)) return false;
    return true;
  }

  function hasTypingStyleActive() {
    if (
      typingFormats.bold || typingFormats.italic || typingFormats.underline || typingFormats.strike ||
      typingFont || typingFontSize
    ) {
      return true;
    }
    return Boolean(applyTypingColor && !selectionHasColor(typingColor));
  }

  function buildFormattedTextNode(text) {
    let node = document.createTextNode(text);

    const needsInlineStyle =
      (applyTypingColor && !selectionHasColor(typingColor)) ||
      (typingFont && !caretHasStyle("fontFamily", typingFont)) ||
      (typingFontSize && !caretHasStyle("fontSize", typingFontSize));

    if (needsInlineStyle) {
      const span = document.createElement("span");
      if (applyTypingColor && !selectionHasColor(typingColor)) span.style.color = typingColor;
      if (typingFont && !caretHasStyle("fontFamily", typingFont)) span.style.fontFamily = typingFont;
      if (typingFontSize && !caretHasStyle("fontSize", typingFontSize)) span.style.fontSize = typingFontSize;
      span.appendChild(node);
      node = span;
    }
    if (typingFormats.strike && !caretHasTag("S", "STRIKE", "DEL")) {
      const el = document.createElement("s");
      el.appendChild(node);
      node = el;
    }
    if (typingFormats.underline && !caretHasTag("U")) {
      const el = document.createElement("u");
      el.appendChild(node);
      node = el;
    }
    if (typingFormats.italic && !caretHasTag("EM", "I")) {
      const el = document.createElement("em");
      el.appendChild(node);
      node = el;
    }
    if (typingFormats.bold && !caretHasTag("STRONG", "B")) {
      const el = document.createElement("strong");
      el.appendChild(node);
      node = el;
    }

    return node;
  }

  function toggleTypingFormat(cmd) {
    const key = FORMAT_CMDS[cmd];
    if (!key) return;

    typingFormats[key] = !typingFormats[key];
    updateFormatButtons();

    const sel = window.getSelection();
    const hasSelection =
      sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed &&
      bodyEl.contains(sel.getRangeAt(0).commonAncestorContainer);

    if (hasSelection) {
      restoreSelection();
      document.execCommand("styleWithCSS", false, "true");
      const execCmd = FORMAT_EXEC[cmd];
      const current = document.queryCommandState(execCmd);
      const want = typingFormats[key];
      if (current !== want) {
        document.execCommand(execCmd, false, null);
      }
      saveSelection();
    } else {
      restoreSelection();
    }
  }

  function wrapSelectionColor(color) {
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!bodyEl.contains(range.commonAncestorContainer) || range.collapsed) return;

    const span = document.createElement("span");
    span.style.color = color;
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(span);
    next.collapse(false);
    sel.addRange(next);
    saveSelection();
  }

  function setTextColor(color) {
    typingColor = color;
    applyTypingColor = true;
    if (colorUnderline) colorUnderline.style.backgroundColor = color;
    if (colorCustom) colorCustom.value = color;

    const sel = window.getSelection();
    const hasSelection =
      sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed &&
      bodyEl.contains(sel.getRangeAt(0).commonAncestorContainer);

    if (hasSelection) {
      wrapSelectionColor(color);
    } else {
      restoreSelection();
    }

    if (colorMenu) colorMenu.hidden = true;
  }

  function applyFontName(name) {
    typingFont = name;
    restoreSelection();
    if (hasTextSelection()) {
      wrapSelectionStyle({ fontFamily: name });
    }
    saveSelection();
  }

  function applyFontSize(sizeKey) {
    typingFontSize = FONT_SIZE_MAP[sizeKey] || "12pt";
    restoreSelection();
    if (hasTextSelection()) {
      wrapSelectionStyle({ fontSize: typingFontSize });
    }
    saveSelection();
  }

  function applyFormatBlock(tag) {
    const blockTag = tag || "p";
    restoreSelection();
    bodyEl.focus();

    const block = getContainingBlock();
    if (block && block.tagName.toLowerCase() !== blockTag) {
      const next = document.createElement(blockTag);
      next.innerHTML = block.innerHTML;
      if (block.style.cssText) next.style.cssText = block.style.cssText;
      block.replaceWith(next);
      placeCaretAtEnd(next);
      return;
    }

    document.execCommand("styleWithCSS", false, "true");
    const attempts = [`<${blockTag}>`, blockTag.toUpperCase(), blockTag];
    for (const fmt of attempts) {
      if (document.execCommand("formatBlock", false, fmt)) break;
    }
    saveSelection();
  }

  function applyJustify(value) {
    const cmdMap = {
      left: "justifyLeft",
      center: "justifyCenter",
      right: "justifyRight",
      full: "justifyFull",
    };
    const align = ALIGN_STYLE_MAP[value] || "left";
    typingAlign = value;
    restoreSelection();
    bodyEl.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmdMap[value] || "justifyLeft", false, null);

    const block = getContainingBlock();
    if (block) block.style.textAlign = align;
    saveSelection();
  }

  function hasTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    return bodyEl.contains(range.commonAncestorContainer) && range.toString().trim().length > 0;
  }

  function insertLink() {
    if (!hasTextSelection()) {
      alert("Select the text you want to link first, then click Link.");
      return;
    }
    const url = window.prompt("Enter the URL (must start with https://)");
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      alert("Links must start with http:// or https://");
      return;
    }
    exec("createLink", url.trim());
  }

  function buildColorPalette() {
    if (!colorSwatches) return;
    colorSwatches.innerHTML = "";
    for (const color of PALETTE) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rte-swatch";
      btn.style.backgroundColor = color;
      btn.title = color;
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", () => setTextColor(color));
      colorSwatches.appendChild(btn);
    }
    if (colorUnderline) colorUnderline.style.backgroundColor = typingColor;
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("csrf_token", csrf);

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf },
      credentials: "same-origin",
      body: formData,
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Upload failed — server returned an invalid response.");
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Upload failed (${res.status}).`);
    }
    return data;
  }

  function insertAtCursor(node) {
    restoreSelection();
    const sel = window.getSelection();
    let range;

    if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
      if (!bodyEl.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(bodyEl);
        range.collapse(false);
      }
    } else {
      range = document.createRange();
      range.selectNodeContents(bodyEl);
      range.collapse(false);
    }

    range.deleteContents();
    range.insertNode(node);

    const after = document.createElement("p");
    after.appendChild(document.createElement("br"));
    node.after(after);

    const newRange = document.createRange();
    newRange.setStart(after, 0);
    newRange.collapse(true);
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    saveSelection();
  }

  let selectedFrame = null;
  let dragState = null;
  let resizeState = null;

  const MIN_IMAGE_SIZE = 40;
  const DEFAULT_IMAGE_WIDTH = 280;
  const DEFAULT_IMAGE_HEIGHT = 200;

  function selectImageFrame(frame) {
    if (selectedFrame && selectedFrame !== frame) {
      selectedFrame.classList.remove("is-selected");
    }
    selectedFrame = frame;
    frame.classList.add("is-selected");
  }

  function clearImageSelection() {
    if (selectedFrame) selectedFrame.classList.remove("is-selected");
    selectedFrame = null;
  }

  function applyFrameLayout(frame, layout) {
    if (layout.left != null) frame.style.left = `${layout.left}px`;
    if (layout.top != null) frame.style.top = `${layout.top}px`;
    if (layout.width != null) frame.style.width = `${layout.width}px`;
    if (layout.height != null) frame.style.height = `${layout.height}px`;
  }

  function readFrameLayout(frame) {
    return {
      left: parseFloat(frame.style.left) || 0,
      top: parseFloat(frame.style.top) || 0,
      width: parseFloat(frame.style.width) || frame.offsetWidth,
      height: parseFloat(frame.style.height) || frame.offsetHeight,
    };
  }

  function updateBodyMinHeight() {
    let maxBottom = 320;
    bodyEl.querySelectorAll(".rte-image-frame").forEach((frame) => {
      const top = parseFloat(frame.style.top) || 0;
      maxBottom = Math.max(maxBottom, top + frame.offsetHeight + 48);
    });
    bodyEl.style.minHeight = `${maxBottom}px`;
  }

  function ensureAbsoluteFrame(frame) {
    if (frame.style.position === "absolute") {
      if (frame.parentElement !== bodyEl) bodyEl.appendChild(frame);
      return;
    }

    const bodyRect = bodyEl.getBoundingClientRect();
    const rect = frame.getBoundingClientRect();
    const width = frame.offsetWidth || DEFAULT_IMAGE_WIDTH;
    const height = frame.offsetHeight || DEFAULT_IMAGE_HEIGHT;

    frame.style.position = "absolute";
    frame.style.margin = "0";
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.left = `${rect.left - bodyRect.left + bodyEl.scrollLeft}px`;
    frame.style.top = `${rect.top - bodyRect.top + bodyEl.scrollTop}px`;

    if (frame.parentElement !== bodyEl) bodyEl.appendChild(frame);
  }

  function createImageFrame(src) {
    const frame = document.createElement("div");
    frame.className = "rte-image-frame";
    frame.contentEditable = "false";
    frame.style.position = "absolute";
    frame.style.margin = "0";

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Uploaded image";
    img.draggable = false;
    frame.appendChild(img);

    const move = document.createElement("button");
    move.type = "button";
    move.className = "rte-img-move";
    move.title = "Drag to move";
    move.textContent = "⋮⋮";
    frame.appendChild(move);

    ["n", "e", "s", "w"].forEach((edge) => {
      const handle = document.createElement("span");
      handle.className = `rte-img-resize rte-img-resize-${edge}`;
      handle.dataset.edge = edge;
      handle.title = "Drag to resize";
      frame.appendChild(handle);
    });

    return frame;
  }

  function readSavedImageLayout(el) {
    if (el.dataset.rtePlacedWrap === "1" || el.dataset.rtePlacedImg === "1") {
      return {
        position: "absolute",
        left: el.dataset.rteLeft ? `${el.dataset.rteLeft}px` : "",
        top: el.dataset.rteTop ? `${el.dataset.rteTop}px` : "",
        width: el.dataset.rteWidth ? `${el.dataset.rteWidth}px` : "",
        height: el.dataset.rteHeight ? `${el.dataset.rteHeight}px` : "",
      };
    }

    const styleAttr = el.getAttribute("style") || "";
    const fromAttr = (prop) => {
      const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i");
      return styleAttr.match(re)?.[1]?.trim() || "";
    };
    const pick = (prop) => {
      const camel = prop.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      return el.style[camel] || el.style[prop] || fromAttr(prop);
    };
    return {
      position: pick("position"),
      left: pick("left"),
      top: pick("top"),
      width: pick("width"),
      height: pick("height"),
    };
  }

  function isPlacedImage(el) {
    if (!el || el.tagName !== "IMG") return false;
    if (el.closest(".rte-image-frame")) return false;
    const layout = readSavedImageLayout(el);
    return el.dataset.rtePlacedImg === "1" || layout.position === "absolute";
  }

  function isPositionedImageWrapper(el) {
    if (!el || el.tagName !== "DIV") return false;
    if (el.classList.contains("rte-image-frame")) return false;
    const layout = readSavedImageLayout(el);
    const positioned =
      el.dataset.rtePlacedWrap === "1" ||
      el.dataset.rtePlacedImg === "1" ||
      layout.position === "absolute";
    if (!positioned) return false;
    const imgs = [...el.querySelectorAll("img")];
    return imgs.length === 1 && imgs[0].parentElement === el;
  }

  function applySavedLayoutToFrame(frame, layout, fallbackTop) {
    frame.style.position = "absolute";
    frame.style.margin = "0";
    frame.style.left = layout.left || "16px";
    frame.style.top = layout.top || `${fallbackTop}px`;
    frame.style.width = layout.width || `${DEFAULT_IMAGE_WIDTH}px`;
    frame.style.height = layout.height || `${DEFAULT_IMAGE_HEIGHT}px`;
  }

  function wrapSavedImageNode(node, layout, fallbackTop) {
    const img = node.tagName === "IMG" ? node : node.querySelector("img");
    if (!img) return;
    const src = img.getAttribute("src");
    if (!src || !/^\/media\/\d+$/i.test(src)) return;

    const frame = createImageFrame(src);
    const hasAbsolute = layout.position === "absolute";
    if (hasAbsolute) {
      applySavedLayoutToFrame(frame, layout, fallbackTop);
    } else {
      const width = parseInt(layout.width, 10) || DEFAULT_IMAGE_WIDTH;
      const height = parseInt(layout.height, 10) || DEFAULT_IMAGE_HEIGHT;
      applySavedLayoutToFrame(frame, {
        left: "16px",
        top: `${fallbackTop}px`,
        width: `${width}px`,
        height: `${height}px`,
      }, fallbackTop);
    }
    node.replaceWith(frame);
    return frame.offsetHeight + 16;
  }

  function wrapBareImages() {
    let stackTop = 16;

    bodyEl.querySelectorAll("div").forEach((div) => {
      if (!isPositionedImageWrapper(div)) return;
      const step = wrapSavedImageNode(div, readSavedImageLayout(div), stackTop);
      if (step) stackTop += step;
    });

    bodyEl.querySelectorAll("img").forEach((img) => {
      if (img.closest(".rte-image-frame")) return;
      if (!isPlacedImage(img) && !img.getAttribute("style")?.includes("position")) return;
      const layout = readSavedImageLayout(img);
      const step = wrapSavedImageNode(img, layout, stackTop);
      if (step) stackTop += step;
    });

    updateBodyMinHeight();
  }

  function buildPlacedWrap(layout, img) {
    const left = Math.round(layout.left);
    const top = Math.round(layout.top);
    const width = Math.max(MIN_IMAGE_SIZE, Math.round(layout.width));
    const height = Math.max(MIN_IMAGE_SIZE, Math.round(layout.height));

    const wrapper = document.createElement("div");
    wrapper.dataset.rtePlacedWrap = "1";
    wrapper.dataset.rteLeft = String(left);
    wrapper.dataset.rteTop = String(top);
    wrapper.dataset.rteWidth = String(width);
    wrapper.dataset.rteHeight = String(height);
    wrapper.setAttribute(
      "style",
      `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;overflow:hidden;margin:0`,
    );

    const out = img.cloneNode(true);
    out.removeAttribute("width");
    out.removeAttribute("height");
    out.removeAttribute("style");
    out.setAttribute("style", "width:100%;height:100%;object-fit:fill;display:block;margin:0");
    wrapper.appendChild(out);
    return wrapper;
  }

  function serializeImageFrame(frame) {
    const img = frame.querySelector("img");
    if (!img) return null;
    return buildPlacedWrap(readFrameLayout(frame), img);
  }

  function getEditorHtml() {
    const liveFrames = [...bodyEl.querySelectorAll(".rte-image-frame")];
    const serialized = liveFrames.map((frame) => serializeImageFrame(frame));
    const clone = bodyEl.cloneNode(true);
    const cloneFrames = [...clone.querySelectorAll(".rte-image-frame")];
    cloneFrames.forEach((node, index) => {
      const out = serialized[index];
      if (out) node.replaceWith(out.cloneNode(true));
      else node.remove();
    });
    return clone.innerHTML;
  }

  function startResize(frame, edge, clientX, clientY) {
    ensureAbsoluteFrame(frame);
    const layout = readFrameLayout(frame);
    resizeState = {
      frame,
      edge,
      startX: clientX,
      startY: clientY,
      startLeft: layout.left,
      startTop: layout.top,
      startWidth: layout.width,
      startHeight: layout.height,
    };
    frame.classList.add("is-resizing");
  }

  function onResizeMove(clientX, clientY) {
    if (!resizeState) return;

    const { frame, edge, startX, startY, startLeft, startTop, startWidth, startHeight } = resizeState;
    const dx = clientX - startX;
    const dy = clientY - startY;
    let left = startLeft;
    let top = startTop;
    let width = startWidth;
    let height = startHeight;

    if (edge === "e") width = Math.max(MIN_IMAGE_SIZE, startWidth + dx);
    if (edge === "w") {
      width = Math.max(MIN_IMAGE_SIZE, startWidth - dx);
      left = startLeft + (startWidth - width);
    }
    if (edge === "s") height = Math.max(MIN_IMAGE_SIZE, startHeight + dy);
    if (edge === "n") {
      height = Math.max(MIN_IMAGE_SIZE, startHeight - dy);
      top = startTop + (startHeight - height);
    }

    applyFrameLayout(frame, { left, top, width, height });
    updateBodyMinHeight();
  }

  function endResize() {
    if (!resizeState) return;
    resizeState.frame.classList.remove("is-resizing");
    resizeState = null;
  }

  function startDrag(frame, clientX, clientY) {
    ensureAbsoluteFrame(frame);
    const layout = readFrameLayout(frame);
    dragState = {
      frame,
      startX: clientX,
      startY: clientY,
      startLeft: layout.left,
      startTop: layout.top,
    };
    frame.classList.add("is-dragging");
  }

  function onDragMove(clientX, clientY) {
    if (!dragState) return;

    const dx = clientX - dragState.startX;
    const dy = clientY - dragState.startY;
    const frame = dragState.frame;
    const width = frame.offsetWidth;
    const maxLeft = Math.max(0, bodyEl.clientWidth - MIN_IMAGE_SIZE);
    const left = Math.max(0, Math.min(maxLeft, dragState.startLeft + dx));
    const top = Math.max(0, dragState.startTop + dy);

    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
    updateBodyMinHeight();
  }

  function endDrag() {
    if (!dragState) return;
    const frame = dragState.frame;
    frame.classList.remove("is-dragging");
    dragState = null;
    selectImageFrame(frame);
  }

  function placeFrameAtCursor(frame) {
    frame.style.position = "absolute";
    frame.style.width = `${DEFAULT_IMAGE_WIDTH}px`;
    frame.style.height = `${DEFAULT_IMAGE_HEIGHT}px`;
    frame.style.margin = "0";

    let left = 16;
    let top = 16;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (bodyEl.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const bodyRect = bodyEl.getBoundingClientRect();
        left = rect.left - bodyRect.left + bodyEl.scrollLeft;
        top = rect.top - bodyRect.top + bodyEl.scrollTop;
      }
    }

    const maxLeft = Math.max(0, bodyEl.clientWidth - DEFAULT_IMAGE_WIDTH);
    left = Math.max(0, Math.min(maxLeft, left));
    top = Math.max(0, top);

    frame.style.left = `${left}px`;
    frame.style.top = `${top}px`;
    bodyEl.appendChild(frame);
    updateBodyMinHeight();
  }

  function setupImageInteractions() {
    bodyEl.addEventListener("mousedown", (e) => {
      if (sourceMode) return;

      const resizeHandle = e.target.closest(".rte-img-resize");
      if (resizeHandle) {
        e.preventDefault();
        const frame = resizeHandle.closest(".rte-image-frame");
        const edge = resizeHandle.dataset.edge;
        if (frame && edge) {
          selectImageFrame(frame);
          startResize(frame, edge, e.clientX, e.clientY);
        }
        return;
      }

      const frame = e.target.closest(".rte-image-frame");
      if (frame) {
        e.preventDefault();
        selectImageFrame(frame);
        startDrag(frame, e.clientX, e.clientY);
        return;
      }

      clearImageSelection();
    });

    document.addEventListener("mousemove", (e) => {
      if (resizeState) {
        e.preventDefault();
        onResizeMove(e.clientX, e.clientY);
      } else if (dragState) {
        e.preventDefault();
        onDragMove(e.clientX, e.clientY);
      }
    });

    document.addEventListener("mouseup", () => {
      if (resizeState) endResize();
      if (dragState) endDrag();
    });

    bodyEl.addEventListener("dragstart", (e) => {
      if (e.target.closest(".rte-image-frame")) e.preventDefault();
    });
  }

  function insertImageNode(url) {
    const frame = createImageFrame(url);
    placeFrameAtCursor(frame);
    selectImageFrame(frame);
    bodyEl.focus();
  }

  async function handleImageFile(file) {
    const result = await uploadImage(file);
    if (!result.url) throw new Error("Upload succeeded but no image URL was returned.");
    insertImageNode(result.url);
  }

  function toggleSource() {
    sourceMode = !sourceMode;
    editorRoot.classList.toggle("is-source", sourceMode);
    if (sourceMode) {
      sourceEl.value = bodyEl.innerHTML;
      sourceEl.hidden = false;
    } else {
      bodyEl.innerHTML = sourceEl.value;
      sourceEl.hidden = true;
      wrapBareImages();
    }
  }

  function toggleFullscreen() {
    editorRoot.classList.toggle("is-fullscreen");
  }

  function serialize() {
    const rawHtml = sourceMode ? sourceEl.value : getEditorHtml();
    const html = stripBodyImages(rawHtml);
    const doc = { v: 2, html };
    const payload = buildSideImagesPayload();
    if (payload.length > 0) doc.sideImages = payload;
    hiddenInput.value = JSON.stringify(doc);
  }

  // Apply chosen color and text styles to newly typed characters
  bodyEl.addEventListener("beforeinput", (e) => {
    if (sourceMode || e.inputType !== "insertText" || !e.data) return;
    if (!hasTypingStyleActive()) return;
    if (typingFormatsSatisfied()) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!bodyEl.contains(range.commonAncestorContainer)) return;

    e.preventDefault();
    const node = buildFormattedTextNode(e.data);
    range.deleteContents();
    range.insertNode(node);

    const next = document.createRange();
    next.setStartAfter(node);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
    saveSelection();
  });

  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest("#rte-color-menu")) return;

    if (e.target.closest("select.rte-select")) {
      saveSelection();
      return;
    }

    saveSelection();

    if (e.target.closest(".rte-image-label")) return;

    const btn = e.target.closest("[data-cmd]");
    if (btn && btn.tagName === "BUTTON") {
      const cmd = btn.dataset.cmd;
      if (cmd === "bold" || cmd === "italic" || cmd === "underline" || cmd === "strikeThrough") {
        e.preventDefault();
        toggleTypingFormat(cmd);
        return;
      }
    }

    e.preventDefault();
  });

  bodyEl.addEventListener("keyup", saveSelection);
  bodyEl.addEventListener("mouseup", saveSelection);

  editorRoot.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-cmd]");
    if (!btn) return;
    if (btn.tagName === "SELECT") return;

    const cmd = btn.dataset.cmd;
    if (!cmd) return;
    event.preventDefault();

    if (cmd === "insertOrderedList") exec("insertOrderedList");
    else if (cmd === "insertUnorderedList") exec("insertUnorderedList");
    else if (cmd === "indent") exec("indent");
    else if (cmd === "outdent") exec("outdent");
    else if (cmd === "undo") exec("undo");
    else if (cmd === "redo") exec("redo");
    else if (cmd === "createLink") insertLink();
    else if (cmd === "code") toggleSource();
    else if (cmd === "fullscreen") toggleFullscreen();
  });

  editorRoot.addEventListener("change", (event) => {
    const el = event.target.closest("select[data-cmd]");
    if (!el) return;

    const cmd = el.dataset.cmd;
    if (cmd === "fontName") applyFontName(el.value);
    else if (cmd === "fontSize") applyFontSize(el.value);
    else if (cmd === "formatBlock") applyFormatBlock(el.value);
    else if (cmd === "justify") applyJustify(el.value);

    bodyEl.focus();
  });

  if (colorTrigger && colorMenu) {
    colorTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      colorMenu.hidden = !colorMenu.hidden;
    });
  }

  if (colorCustom) {
    colorCustom.addEventListener("input", () => setTextColor(colorCustom.value));
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#rte-color-wrap") && colorMenu) {
      colorMenu.hidden = true;
    }
  });

  if (postImageInput) {
    postImageInput.addEventListener("change", async () => {
      const file = postImageInput.files?.[0];
      postImageInput.value = "";
      if (!file) return;
      if (sideImages.length >= MAX_SIDE_IMAGES) {
        alert(`You can add up to ${MAX_SIDE_IMAGES} images.`);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      try {
        const result = await uploadImage(file);
        sideImages.push({ id: result.id, side: "right", previewUrl });
        renderPostImageGallery();
        syncHiddenDocument(bodyEl.innerHTML);
      } catch (err) {
        URL.revokeObjectURL(previewUrl);
        alert(err.message || "Image upload failed.");
      }
    });
  }

  form.addEventListener("submit", (event) => {
    if (sourceMode) bodyEl.innerHTML = sourceEl.value;
    serialize();
    const parsed = JSON.parse(hiddenInput.value || "{}");
    const hasText = (parsed.html || "").replace(/<[^>]+>/g, "").trim().length > 0;
    const hasImages = Array.isArray(parsed.sideImages) && parsed.sideImages.length > 0;
    if (!hasText && !hasImages) {
      event.preventDefault();
      alert("Add some text or upload an image before publishing.");
    }
  });

  buildColorPalette();
  const initialHtml = parseInitialDocument();
  bodyEl.innerHTML = initialHtml;
  renderPostImageGallery();
  syncHiddenDocument(initialHtml);
})();
