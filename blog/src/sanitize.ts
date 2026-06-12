const ALLOWED_TAGS = new Set([
  "p", "div", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "strike",
  "span", "ul", "ol", "li", "a", "img", "br", "blockquote",
]);

const STYLE_PROPS = new Set([
  "color", "background-color", "font-size", "font-family", "text-align",
  "width", "height", "position", "left", "top", "object-fit", "margin", "display", "overflow",
]);

const SAFE_SIZE_RE = /^\d+(\.\d+)?(px|%)$/;
const SAFE_OFFSET_RE = /^\d+(\.\d+)?px$/;
const SAFE_POSITION_RE = /^absolute$/;
const SAFE_OBJECT_FIT_RE = /^fill$/;
const SAFE_DISPLAY_RE = /^block$/;
const SAFE_OVERFLOW_RE = /^hidden$/;

function cleanStyle(style: string): string {
  return style
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const colon = part.indexOf(":");
      if (colon < 1) return false;
      const prop = part.slice(0, colon).trim().toLowerCase();
      const value = part.slice(colon + 1).trim().toLowerCase();
      if (!STYLE_PROPS.has(prop)) return false;
      if (value.includes("javascript:") || value.includes("expression(")) return false;
      if ((prop === "width" || prop === "height") && !SAFE_SIZE_RE.test(value)) return false;
      if ((prop === "left" || prop === "top") && !SAFE_OFFSET_RE.test(value)) return false;
      if (prop === "position" && !SAFE_POSITION_RE.test(value)) return false;
      if (prop === "object-fit" && !SAFE_OBJECT_FIT_RE.test(value)) return false;
      if (prop === "margin" && value !== "0") return false;
      if (prop === "display" && !SAFE_DISPLAY_RE.test(value)) return false;
      if (prop === "overflow" && !SAFE_OVERFLOW_RE.test(value)) return false;
      return true;
    })
    .join("; ");
}

function stripDangerous(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function sanitizeWithRewriter(html: string): Promise<string> {
  const rewriter = new HTMLRewriter().on("*", {
    element(el) {
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        el.remove();
        return;
      }

      if (tag === "a") {
        const href = el.getAttribute("href");
        if (!href || !/^https?:\/\//i.test(href)) {
          el.removeAttribute("href");
        }
      }

      if (tag === "img") {
        const src = el.getAttribute("src");
        if (!src || !/^\/media\/\d+$/i.test(src)) {
          el.remove();
          return;
        }
        el.removeAttribute("onerror");
      }

      const style = el.getAttribute("style");
      if (style) {
        const safe = cleanStyle(style);
        if (safe) el.setAttribute("style", safe);
        else el.removeAttribute("style");
      }

      el.removeAttribute("class");
      el.removeAttribute("id");
    },
  });

  return rewriter.transform(new Response(html)).text();
}

function sanitizeBasic(html: string): string {
  let out = stripDangerous(html);
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (tag === "br") return "<br>";
    if (match.startsWith("</")) return `</${tag}>`;

    if (tag === "img") {
      const src = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i);
      const url = src?.[2] || src?.[3] || "";
      if (!/^\/media\/\d+$/i.test(url)) return "";
      const styleMatch = attrs.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
      const style = styleMatch?.[2] || styleMatch?.[3] || "";
      const safeStyle = cleanStyle(style);
      return safeStyle ? `<img src="${url}" alt="" style="${safeStyle}" />` : `<img src="${url}" alt="" />`;
    }

    if (tag === "a") {
      const href = attrs.match(/\shref\s*=\s*("([^"]*)"|'([^']*)')/i);
      const url = href?.[2] || href?.[3] || "";
      if (!/^https?:\/\//i.test(url)) return `<${tag}>`;
      return `<a href="${url}">`;
    }

    const styleMatch = attrs.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
    const style = styleMatch?.[2] || styleMatch?.[3] || "";
    const safeStyle = cleanStyle(style);
    return safeStyle ? `<${tag} style="${safeStyle}">` : `<${tag}>`;
  });
  return out;
}

export async function sanitizeHtml(html: string): Promise<string> {
  const cleaned = stripDangerous(html);
  if (typeof HTMLRewriter !== "undefined") {
    try {
      return await sanitizeWithRewriter(cleaned);
    } catch {
      /* fall through */
    }
  }
  return sanitizeBasic(cleaned);
}

export function htmlHasContent(html: string): boolean {
  const text = html
    .replace(/<img[^>]*>/gi, "x")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 || /<img\s/i.test(html);
}

export function htmlPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
