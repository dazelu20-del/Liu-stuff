import { describe, it, expect } from "vitest";
import { renderPostForm } from "../src/html";

describe("renderPostForm", () => {
  const session = { userId: 1, username: "alice", csrfToken: "test-csrf-token" };

  it("embeds saved v2 html in the edit form", () => {
    const html = renderPostForm("edit", session, {
      id: 7,
      author_id: 1,
      title: "Saved title",
      body: JSON.stringify({ v: 2, html: "<p>Hello <strong>world</strong></p>" }),
      created_at: "2026-01-01",
      updated_at: null,
    });

    expect(html).toContain("Saved title");
    expect(html).toContain("Hello");
    expect(html).toContain("&lt;strong&gt;world&lt;/strong&gt;");
    expect(html).toContain('id="initial-document"');
    expect(html).toContain('id="post-document"');
  });
});
