import { describe, it, expect } from "vitest";
import { htmlHasContent, sanitizeHtml } from "../src/sanitize";

describe("sanitize", () => {
  it("allows lists and colors", async () => {
    const html = '<ul><li style="color: #ff0000">Red item</li></ul>';
    const clean = await sanitizeHtml(html);
    expect(clean).toContain("color");
    expect(clean).toContain("Red item");
  });

  it("allows only owned media paths", async () => {
    const good = await sanitizeHtml('<img src="/media/12" alt="" />');
    expect(good).toContain("/media/12");
    const bad = await sanitizeHtml('<img src="https://evil.com/x.jpg" />');
    expect(bad).not.toContain("evil.com");
  });

  it("preserves safe image width styles", async () => {
    const html = await sanitizeHtml('<img src="/media/3" style="width: 320px" alt="" />');
    expect(html).toContain("width: 320px");
  });

  it("preserves absolute image layout styles", async () => {
    const html = await sanitizeHtml(
      '<img src="/media/5" style="position: absolute; left: 120px; top: 40px; width: 300px; height: 180px; object-fit: fill" alt="" />',
    );
    expect(html).toContain("position: absolute");
    expect(html).toContain("left: 120px");
    expect(html).toContain("height: 180px");
    expect(html).toContain("object-fit: fill");
  });

  it("preserves placed image wrapper dimensions", async () => {
    const html = await sanitizeHtml(
      '<div data-rte-placed-wrap="1" data-rte-left="20" data-rte-top="60" data-rte-width="240" data-rte-height="140" ' +
      'style="position:absolute;left:20px;top:60px;width:240px;height:140px;overflow:hidden;margin:0">' +
      '<img src="/media/8" alt="" style="width:100%;height:100%;object-fit:fill;display:block;margin:0" /></div>',
    );
    expect(html).toMatch(/position:\s*absolute/);
    expect(html).toMatch(/width:\s*240px/);
    expect(html).toMatch(/height:\s*140px/);
    expect(html).toMatch(/overflow:\s*hidden/);
    expect(html).toMatch(/object-fit:\s*fill/);
  });

  it("detects empty html", () => {
    expect(htmlHasContent("<p><br></p>")).toBe(false);
    expect(htmlHasContent('<p>Hello</p>')).toBe(true);
    expect(htmlHasContent('<img src="/media/1" />')).toBe(true);
  });
});
