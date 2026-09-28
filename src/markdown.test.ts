import { describe, expect, test } from "vitest";
import {
  inlineHtml,
  lineAtOffset,
  liveBlockFromText,
  markdownToHtml,
  parseBlock,
  toVisibleText,
  visibleCaretOffset
} from "./markdown";

describe("live block parsing", () => {
  test.each([
    ["#Title", "h1", "Title"],
    ["# Title", "h1", "Title"],
    ["##Heading", "h2", "Heading"],
    ["## Heading", "h2", "Heading"],
    ["## NEW", "h2", "NEW"],
    ["\n## NEW", "h2", "NEW"],
    ["\u200B## NEW", "h2", "NEW"],
    [" ## NEW", "h2", "NEW"],
    ["### H3", "h3", "H3"],
    ["#### H4", "h4", "H4"],
    ["##### H5", "h5", "H5"],
    ["###### H6", "h6", "H6"]
  ])("%s becomes %s", (raw, tag, body) => {
    expect(parseBlock(raw)).toMatchObject({ tag, body });
  });

  test("does not convert incomplete headings", () => {
    expect(parseBlock("#")).toBeNull();
    expect(parseBlock("##")).toBeNull();
    expect(parseBlock("# ")).toBeNull();
    expect(parseBlock("hello\n## NEW")).toBeNull();
  });

  test("reads the heading on the current line", () => {
    expect(lineAtOffset("hello\n## NEW", 12)).toMatchObject({ text: "## NEW", offset: 6 });
    expect(parseBlock(lineAtOffset("hello\n## NEW", 12).text)).toMatchObject({ tag: "h2", body: "NEW" });
  });

  test("lists and quotes", () => {
    expect(parseBlock("- item")).toMatchObject({ tag: "li", list: "ul", body: "item" });
    expect(parseBlock("* item")).toMatchObject({ tag: "li", list: "ul", body: "item" });
    expect(parseBlock("+ item")).toMatchObject({ tag: "li", list: "ul", body: "item" });
    expect(parseBlock("1. first")).toMatchObject({ tag: "li", list: "ol", body: "first" });
    expect(parseBlock("2) second")).toMatchObject({ tag: "li", list: "ol", body: "second" });
    expect(parseBlock("> quote")).toMatchObject({ tag: "blockquote", body: "quote" });
    expect(parseBlock(">quote")).toMatchObject({ tag: "blockquote", body: "quote" });
  });

  test("*italic* is not a list", () => {
    expect(parseBlock("*italic*")).toMatchObject({ tag: "p" });
    expect(liveBlockFromText("*italic*")?.innerHtml).toContain("<em>italic</em>");
  });
});

describe("inline markdown", () => {
  test("bold italic strike code link", () => {
    expect(inlineHtml("**bold**")).toBe("<strong>bold</strong>");
    expect(inlineHtml("__bold__")).toBe("<strong>bold</strong>");
    expect(inlineHtml("*italic*")).toBe("<em>italic</em>");
    expect(inlineHtml("_italic_")).toBe("<em>italic</em>");
    expect(inlineHtml("~~gone~~")).toBe("<s>gone</s>");
    expect(inlineHtml("`code`")).toBe("<code>code</code>");
    expect(inlineHtml("[Papernote](https://example.com)")).toBe(
      '<a href="https://example.com">Papernote</a>'
    );
    expect(inlineHtml("***both***")).toBe("<strong><em>both</em></strong>");
  });

  test("keeps surrounding words", () => {
    expect(inlineHtml("say **bold** now")).toBe("say <strong>bold</strong> now");
    expect(inlineHtml("a *i* z")).toBe("a <em>i</em> z");
  });

  test("does not convert incomplete markers", () => {
    expect(parseBlock("**bold")).toBeNull();
    expect(parseBlock("*ital")).toBeNull();
    expect(parseBlock("~~gone")).toBeNull();
    expect(parseBlock("[link](https")).toBeNull();
    expect(parseBlock("`code")).toBeNull();
  });
});

describe("caret after conversion", () => {
  test("strips markers before the caret", () => {
    expect(toVisibleText("# Title")).toBe("Title");
    expect(visibleCaretOffset("**bold**", 8)).toBe(4);
    expect(visibleCaretOffset("##Hello", 7)).toBe(5);
    expect(visibleCaretOffset("- item", 6)).toBe(4);
  });
});

describe("images", () => {
  test("image markdown becomes an img", () => {
    expect(inlineHtml("![photo](papernote-image://abc.png)")).toBe(
      '<img alt="photo" src="papernote-image://abc.png">'
    );
    expect(parseBlock("![photo](papernote-image://abc.png)")?.innerHtml).toContain("<img");
    expect(markdownToHtml("![photo](https://x.test/a.png)")).toContain("<img alt=\"photo\"");
  });

  test("links still work and images are not treated as links", () => {
    expect(inlineHtml("[Papernote](https://example.com)")).toBe(
      '<a href="https://example.com">Papernote</a>'
    );
  });
});

describe("markdownToHtml", () => {
  test("renders a full note", () => {
    const html = markdownToHtml(
      [
        "# Title",
        "",
        "A **bold** and *italic* and ~~strike~~ and `code` and [link](https://x.test).",
        "",
        "- one",
        "- two",
        "",
        "1. first",
        "",
        "> quiet"
      ].join("\n")
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<s>strike</s>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('<a href="https://x.test">link</a>');
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<blockquote>quiet</blockquote>");
  });
});
