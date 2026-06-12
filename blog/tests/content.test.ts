import { describe, it, expect } from "vitest";
import {
  bodyToEditorHtml,
  normalizeDocumentV1,
  normalizeSideImage,
  normalizeSideImages,
  previewText,
  renderPostBodyHtml,
  resolvePostDocument,
  serializeDocumentV1,
  stripEmbeddedImages,
} from "../src/content";
import { htmlHasContent, sanitizeHtml } from "../src/sanitize";

describe("content", () => {
  it("wraps legacy plain text", () => {
    expect(bodyToEditorHtml("Hello world")).toContain("Hello world");
    expect(previewText("Hello world")).toBe("Hello world");
  });

  it("normalizes v1 document", () => {
    const result = normalizeDocumentV1({
      v: 1,
      blocks: [
        { type: "text", runs: [{ text: "Hi", bold: true }] },
        { type: "media", id: 3, align: "center", width: 80 },
      ],
    });
    expect(typeof result).not.toBe("string");
    if (typeof result !== "string") {
      expect(result.blocks).toHaveLength(2);
      expect(serializeDocumentV1(result)).toContain('"id":3');
    }
  });

  it("renders v2 html posts", () => {
    const raw = JSON.stringify({ v: 2, html: "<p><strong>Hi</strong></p>" });
    const html = renderPostBodyHtml(raw);
    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain("post-layout--text-only");
    expect(previewText(raw)).toBe("Hi");
  });

  it("renders multiple side images beside text", () => {
    const raw = JSON.stringify({
      v: 2,
      html: "<p>Hello</p>",
      sideImages: [
        { id: 5, side: "right" },
        { id: 7, side: "right" },
      ],
    });
    const html = renderPostBodyHtml(raw);
    expect(html).toContain("post-layout--image-right");
    expect(html).toContain("post-layout-images");
    expect(html).toContain('/media/5"');
    expect(html).toContain('/media/7"');
    expect(html).not.toContain("position:absolute");
  });

  it("migrates legacy embedded images to side images", () => {
    const legacy = JSON.stringify({
      v: 2,
      html:
        '<p>Dice</p><img src="/media/9" alt="" />' +
        '<div data-rte-placed-wrap="1"><img src="/media/11" alt="" /></div>',
    });
    const doc = resolvePostDocument(legacy);
    expect(doc.sideImages?.map((img) => img.id)).toEqual([9, 11]);
    expect(doc.html).not.toContain("/media/");
    expect(stripEmbeddedImages(doc.html)).toBe("<p>Dice</p>");
  });

  it("normalizes side image arrays and legacy single field", () => {
    expect(normalizeSideImage({ id: 4, side: "left" })).toEqual({ id: 4, side: "left" });
    expect(normalizeSideImages([{ id: 2, side: "right" }, { id: 3, side: "right" }])).toHaveLength(2);
    expect(normalizeSideImages(undefined, { id: 6, side: "left" })).toEqual([{ id: 6, side: "left" }]);
  });

  it("sanitizes dangerous html", async () => {
    const clean = await sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(clean).toContain("ok");
    expect(clean).not.toContain("script");
    expect(htmlHasContent(clean)).toBe(true);
  });
});
