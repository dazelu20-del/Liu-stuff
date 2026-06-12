import { escapeHtml } from "./util";
import { htmlPlainText } from "./sanitize";

export type TextSize = "small" | "normal" | "large" | "xlarge";
export type TextFont = "sans" | "serif" | "mono";
export type BlockAlign = "left" | "center" | "right" | "full";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: TextSize;
  font?: TextFont;
}

export interface TextBlock {
  type: "text";
  align?: Exclude<BlockAlign, "full">;
  runs: TextRun[];
}

export interface MediaBlock {
  type: "media";
  id: number;
  align?: BlockAlign;
  width?: number;
}

export type ContentBlock = TextBlock | MediaBlock;

export interface PostDocumentV1 {
  v: 1;
  blocks: ContentBlock[];
}

export type SideImageSide = "left" | "right";

export interface SideImage {
  id: number;
  side: SideImageSide;
}

export interface PostDocumentV2 {
  v: 2;
  html: string;
  sideImages?: SideImage[];
  /** @deprecated legacy single-image field */
  sideImage?: SideImage;
}

const TEXT_SIZES = new Set<TextSize>(["small", "normal", "large", "xlarge"]);
const TEXT_FONTS = new Set<TextFont>(["sans", "serif", "mono"]);
const TEXT_ALIGNS = new Set(["left", "center", "right"]);
const MEDIA_ALIGNS = new Set<BlockAlign>(["left", "center", "right", "full"]);

export function isPostDocument(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("{") && trimmed.includes('"v"');
}

export function parsePostBodyV1(raw: string): PostDocumentV1 {
  if (!isPostDocument(raw)) {
    const text = raw.trim();
    return { v: 1, blocks: [{ type: "text", runs: [{ text }] }] };
  }
  try {
    const parsed = JSON.parse(raw) as PostDocumentV1;
    if (parsed?.v === 1 && Array.isArray(parsed.blocks)) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return { v: 1, blocks: [{ type: "text", runs: [{ text: raw.trim() }] }] };
}

function normalizeRun(run: unknown): TextRun | null {
  if (!run || typeof run !== "object") return null;
  const r = run as Record<string, unknown>;
  if (typeof r.text !== "string" || !r.text) return null;
  const out: TextRun = { text: r.text };
  if (r.bold === true) out.bold = true;
  if (r.italic === true) out.italic = true;
  if (r.underline === true) out.underline = true;
  if (typeof r.size === "string" && TEXT_SIZES.has(r.size as TextSize)) {
    out.size = r.size as TextSize;
  }
  if (typeof r.font === "string" && TEXT_FONTS.has(r.font as TextFont)) {
    out.font = r.font as TextFont;
  }
  return out;
}

function normalizeTextBlock(block: Record<string, unknown>): TextBlock | null {
  const runsRaw = block.runs;
  if (!Array.isArray(runsRaw)) return null;
  const runs = runsRaw.map(normalizeRun).filter((r): r is TextRun => r !== null);
  if (runs.length === 0) return null;
  const align =
    typeof block.align === "string" && TEXT_ALIGNS.has(block.align)
      ? (block.align as TextBlock["align"])
      : "left";
  return { type: "text", align, runs };
}

function normalizeMediaBlock(block: Record<string, unknown>): MediaBlock | null {
  const id = typeof block.id === "number" ? block.id : Number(block.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const align =
    typeof block.align === "string" && MEDIA_ALIGNS.has(block.align as BlockAlign)
      ? (block.align as BlockAlign)
      : "center";
  let width = 100;
  if (typeof block.width === "number" && block.width >= 20 && block.width <= 100) {
    width = Math.round(block.width);
  }
  return { type: "media", id, align, width };
}

export function normalizeDocumentV1(input: unknown): PostDocumentV1 | string {
  if (!input || typeof input !== "object") return "Invalid post content.";
  const doc = input as Record<string, unknown>;
  if (doc.v !== 1 || !Array.isArray(doc.blocks)) return "Invalid post content.";

  const blocks: ContentBlock[] = [];
  for (const raw of doc.blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Record<string, unknown>;
    if (block.type === "text") {
      const text = normalizeTextBlock(block);
      if (text) blocks.push(text);
    } else if (block.type === "media") {
      const media = normalizeMediaBlock(block);
      if (!media) return "Invalid image block.";
      blocks.push(media);
    }
  }

  if (blocks.length === 0) return "Post body cannot be empty.";
  const hasText = blocks.some(
    (b) => b.type === "text" && b.runs.some((r) => r.text.trim().length > 0)
  );
  const hasMedia = blocks.some((b) => b.type === "media");
  if (!hasText && !hasMedia) return "Post body cannot be empty.";

  return { v: 1, blocks };
}

export function serializeDocumentV1(doc: PostDocumentV1): string {
  return JSON.stringify(doc);
}

function renderRun(run: TextRun): string {
  let html = escapeHtml(run.text);
  const classes: string[] = [];
  if (run.size && run.size !== "normal") classes.push(`text-${run.size}`);
  if (run.font && run.font !== "sans") classes.push(`text-font-${run.font}`);
  if (classes.length) {
    html = `<span class="${classes.join(" ")}">${html}</span>`;
  }
  if (run.underline) html = `<u>${html}</u>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  return html;
}

function alignClass(align: string | undefined, prefix: string): string {
  const value = align ?? "left";
  return `${prefix}-align-${value}`;
}

export function renderDocumentV1Html(doc: PostDocumentV1): string {
  return doc.blocks
    .map((block) => {
      if (block.type === "text") {
        const inner = block.runs.map(renderRun).join("");
        const align = block.align ?? "left";
        return `<div class="content-text ${alignClass(align, "content")}">${inner || "<br>"}</div>`;
      }
      const url = `/media/${block.id}`;
      const width = block.width ?? 100;
      const align = block.align ?? "center";
      const wrapClass = `content-media ${alignClass(align, "content")}`;
      const style = align !== "full" ? ` style="width:${width}%"` : "";
      return `<figure class="${wrapClass}"${style}><img src="${escapeHtml(url)}" alt="" loading="lazy" /></figure>`;
    })
    .join("\n");
}

function readPlacedLayout(attrs: string, style: string): { top: number; height: number } | null {
  const topAttr = attrs.match(/data-rte-top\s*=\s*["']([^"']+)["']/i)?.[1];
  const heightAttr = attrs.match(/data-rte-height\s*=\s*["']([^"']+)["']/i)?.[1];
  const top = parseFloat(topAttr ?? style.match(/top\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? "0");
  const height = parseFloat(heightAttr ?? style.match(/height\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? "0");
  if (!Number.isFinite(top) || !Number.isFinite(height) || height <= 0) return null;
  return { top, height };
}

function readPlacedAttrs(attrs: string): {
  left: string;
  top: string;
  width: string;
  height: string;
} | null {
  const style = attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const left = attrs.match(/data-rte-left\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? style.match(/left\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
  const top = attrs.match(/data-rte-top\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? style.match(/top\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
  const width = attrs.match(/data-rte-width\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? style.match(/width\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
  const height = attrs.match(/data-rte-height\s*=\s*["']([^"']+)["']/i)?.[1]
    ?? style.match(/height\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1];
  if (!left || !top || !width || !height) return null;
  return { left, top, width, height };
}

function isPlacedLayoutMarker(attrs: string): boolean {
  if (/data-rte-placed-wrap\s*=\s*["']1["']/i.test(attrs)) return true;
  if (/data-rte-placed-img\s*=\s*["']1["']/i.test(attrs)) return true;
  const style = attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  return /position\s*:\s*absolute/i.test(style);
}

function buildPlacedWrapTag(src: string, layout: { left: string; top: string; width: string; height: string }): string {
  const wrapStyle =
    `position:absolute;left:${layout.left}px;top:${layout.top}px;width:${layout.width}px;` +
    `height:${layout.height}px;overflow:hidden;margin:0`;
  const imgStyle = "width:100%;height:100%;object-fit:fill;display:block;margin:0";
  return (
    `<div data-rte-placed-wrap="1" data-rte-left="${layout.left}" data-rte-top="${layout.top}" ` +
    `data-rte-width="${layout.width}" data-rte-height="${layout.height}" style="${wrapStyle}">` +
    `<img src="${src}" alt="" style="${imgStyle}" /></div>`
  );
}

export function repairPlacedImageHtml(html: string): string {
  let out = html.replace(
    /<div\b([^>]*?)>\s*(<img\b[^>]*>)\s*<\/div>/gi,
    (full, divAttrs, imgTag) => {
      if (!isPlacedLayoutMarker(divAttrs)) return full;

      const layout = readPlacedAttrs(divAttrs);
      const src = imgTag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i)?.[2]
        ?? imgTag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i)?.[3];
      if (!layout || !src || !/^\/media\/\d+$/i.test(src)) return full;
      return buildPlacedWrapTag(src, layout);
    },
  );

  out = out.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    if (!isPlacedLayoutMarker(attrs)) return full;

    const layout = readPlacedAttrs(attrs);
    const src = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i)?.[2]
      ?? attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i)?.[3];
    if (!layout || !src || !/^\/media\/\d+$/i.test(src)) return full;
    return buildPlacedWrapTag(src, layout);
  });

  return out;
}

function considerPlacedElement(attrs: string, maxBottom: number): number {
  const style = attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const layout = readPlacedLayout(attrs, style);
  if (layout) return Math.max(maxBottom, layout.top + layout.height + 48);

  if (/position\s*:\s*absolute/i.test(style)) {
    const top = parseFloat(style.match(/top\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? "0");
    const height = parseFloat(style.match(/height\s*:\s*(\d+(?:\.\d+)?)px/i)?.[1] ?? "0");
    if (height > 0) return Math.max(maxBottom, top + height + 48);
  }

  return maxBottom;
}

export function postBodyMinHeight(html: string): number {
  let maxBottom = 120;
  for (const re of [/<div\b([^>]*)>/gi, /<img\b([^>]*)>/gi]) {
    let match = re.exec(html);
    while (match) {
      maxBottom = considerPlacedElement(match[1], maxBottom);
      match = re.exec(html);
    }
  }
  return maxBottom;
}

export function normalizeSideImage(input: unknown): SideImage | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  const id = typeof value.id === "number" ? value.id : Number(value.id);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  const side: SideImageSide = value.side === "left" ? "left" : "right";
  return { id, side };
}

export function normalizeSideImages(
  input: unknown,
  legacySingle?: unknown,
  defaultSide: SideImageSide = "right",
): SideImage[] {
  const out: SideImage[] = [];
  const seen = new Set<number>();

  const add = (item: unknown) => {
    const img = normalizeSideImage(item);
    if (!img || seen.has(img.id)) return;
    seen.add(img.id);
    out.push(img);
  };

  if (Array.isArray(input)) {
    for (const item of input) add(item);
  }
  add(legacySingle);
  return out;
}

function extractMediaIdsFromHtml(html: string): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const match of html.matchAll(/\/media\/(\d+)/gi)) {
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function stripEmbeddedImages(html: string): string {
  let out = html
    .replace(/<div\b[^>]*data-rte-placed-wrap[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div\b[^>]*data-rte-placed-img[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<img\b[^>]*>/gi, "");
  out = out.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "").trim();
  if (!out || !/<[a-z]/i.test(out)) return "<p><br></p>";
  return out;
}

function v1BlocksToHtml(blocks: ContentBlock[]): { html: string; sideImages: SideImage[] } {
  const parts: string[] = [];
  const sideImages: SideImage[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      parts.push(`<div class="content-text">${block.runs.map(renderRun).join("") || "<br>"}</div>`);
    } else {
      sideImages.push({ id: block.id, side: "right" });
    }
  }

  return {
    html: parts.length > 0 ? parts.join("") : "<p><br></p>",
    sideImages,
  };
}

export function resolvePostDocument(raw: string): PostDocumentV2 {
  const trimmed = raw.trim();
  if (!trimmed) return { v: 2, html: "<p><br></p>" };

  if (!trimmed.startsWith("{")) {
    return { v: 2, html: `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>` };
  }

  try {
    const parsed = JSON.parse(trimmed) as PostDocumentV1 | PostDocumentV2;
    if (parsed.v === 2 && typeof parsed.html === "string") {
      let sideImages = normalizeSideImages(parsed.sideImages, parsed.sideImage);
      if (sideImages.length === 0) {
        sideImages = extractMediaIdsFromHtml(parsed.html).map((id, index) => ({
          id,
          side: (index % 2 === 0 ? "left" : "right") as SideImageSide,
        }));
      }
      const html = stripEmbeddedImages(parsed.html || "<p><br></p>");
      return sideImages.length > 0 ? { v: 2, html, sideImages } : { v: 2, html };
    }
    if (parsed.v === 1 && Array.isArray(parsed.blocks)) {
      const converted = v1BlocksToHtml(parsed.blocks);
      const html = stripEmbeddedImages(converted.html);
      return converted.sideImages.length > 0
        ? { v: 2, html, sideImages: converted.sideImages }
        : { v: 2, html };
    }
  } catch {
    /* fall through */
  }

  return { v: 2, html: "<p><br></p>" };
}

export function editorInitialPayload(raw: string): PostDocumentV2 {
  return resolvePostDocument(raw);
}

export function bodyToEditorHtml(raw: string): string {
  return resolvePostDocument(raw).html;
}

function renderSideImageColumn(images: SideImage[], side: SideImageSide): string {
  const items = images.filter((img) => img.side === side);
  if (items.length === 0) return "";

  const figures = items
    .map((img) => {
      const url = `/media/${img.id}`;
      return (
        `<figure class="post-layout-image">` +
        `<img src="${escapeHtml(url)}" alt="" loading="lazy" /></figure>`
      );
    })
    .join("");

  return `<div class="post-layout-images post-layout-images--${side}">${figures}</div>`;
}

export function renderPostBodyHtml(raw: string): string {
  const doc = resolvePostDocument(raw);
  const textBlock = `<div class="rich-content post-layout-text">${doc.html}</div>`;
  const sideImages = doc.sideImages ?? [];

  if (sideImages.length === 0) {
    return `<div class="post-body-canvas post-layout post-layout--text-only">${textBlock}</div>`;
  }

  const leftCol = renderSideImageColumn(sideImages, "left");
  const rightCol = renderSideImageColumn(sideImages, "right");
  const layoutClass =
    leftCol && rightCol
      ? "post-layout--split"
      : leftCol
        ? "post-layout--left-only"
        : "post-layout--right-only";

  return (
    `<div class="post-body-canvas post-layout ${layoutClass}">` +
    `${leftCol}${textBlock}${rightCol}</div>`
  );
}

export function previewText(raw: string): string {
  const doc = resolvePostDocument(raw);
  return htmlPlainText(doc.html);
}

// Back-compat aliases for older imports
export const parsePostBody = parsePostBodyV1;
export const normalizeDocument = normalizeDocumentV1;
export const serializeDocument = serializeDocumentV1;
export const renderDocumentHtml = renderDocumentV1Html;
