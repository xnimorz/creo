import { describe, test, expect } from "bun:test";
import { parseMarkdown } from "./parse";
import { isBlockNode, isTextNode, nodesEqual } from "../model/types";
import { doc, p, heading, blockquote, codeBlock, hr, ul, ol, li, bold, italic, code, strikethrough, link } from "../test-utils/builders";

describe("parseMarkdown: paragraphs", () => {
  test("single paragraph", () => {
    const result = parseMarkdown("Hello world");
    expect(result.type).toBe("doc");
    expect(result.content.length).toBe(1);
    const para = result.content[0]!;
    expect(isBlockNode(para) && para.type === "paragraph").toBe(true);
    if (isBlockNode(para)) {
      expect(para.content.length).toBe(1);
      const text = para.content[0]!;
      expect(isTextNode(text) && text.text === "Hello world").toBe(true);
    }
  });

  test("multiple paragraphs", () => {
    const result = parseMarkdown("First\n\nSecond");
    expect(result.content.length).toBe(2);
  });

  test("empty input produces doc with empty paragraph", () => {
    const result = parseMarkdown("");
    expect(result.type).toBe("doc");
    expect(result.content.length).toBe(1);
    const para = result.content[0]!;
    expect(isBlockNode(para) && para.type === "paragraph").toBe(true);
  });
});

describe("parseMarkdown: headings", () => {
  test("h1", () => {
    const result = parseMarkdown("# Title");
    const h = result.content[0]!;
    expect(isBlockNode(h) && h.type === "heading").toBe(true);
    if (isBlockNode(h)) {
      expect((h.attrs as Record<string, unknown>)["level"]).toBe(1);
    }
  });

  test("h3", () => {
    const result = parseMarkdown("### Title");
    const h = result.content[0]!;
    if (isBlockNode(h)) {
      expect((h.attrs as Record<string, unknown>)["level"]).toBe(3);
    }
  });

  test("heading with inline marks", () => {
    const result = parseMarkdown("# **Bold** title");
    const h = result.content[0]!;
    if (isBlockNode(h)) {
      expect(h.content.length).toBeGreaterThanOrEqual(2);
      const boldText = h.content[0]!;
      if (isTextNode(boldText)) {
        expect(boldText.marks.some(m => m.type === "bold")).toBe(true);
      }
    }
  });
});

describe("parseMarkdown: inline marks", () => {
  test("bold", () => {
    const result = parseMarkdown("**bold**");
    const para = result.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        expect(text.text).toBe("bold");
        expect(text.marks.some(m => m.type === "bold")).toBe(true);
      }
    }
  });

  test("italic", () => {
    const result = parseMarkdown("*italic*");
    const para = result.content[0]!;
    if (isBlockNode(para) && isTextNode(para.content[0]!)) {
      expect(para.content[0]!.marks.some(m => m.type === "italic")).toBe(true);
    }
  });

  test("inline code", () => {
    const result = parseMarkdown("`code`");
    const para = result.content[0]!;
    if (isBlockNode(para) && isTextNode(para.content[0]!)) {
      expect(para.content[0]!.marks.some(m => m.type === "code")).toBe(true);
    }
  });

  test("strikethrough", () => {
    const result = parseMarkdown("~~deleted~~");
    const para = result.content[0]!;
    if (isBlockNode(para) && isTextNode(para.content[0]!)) {
      expect(para.content[0]!.marks.some(m => m.type === "strikethrough")).toBe(true);
    }
  });

  test("link", () => {
    const result = parseMarkdown("[click](https://example.com)");
    const para = result.content[0]!;
    if (isBlockNode(para) && isTextNode(para.content[0]!)) {
      const linkMark = para.content[0]!.marks.find(m => m.type === "link");
      expect(linkMark).toBeDefined();
      expect((linkMark!.attrs as Record<string, unknown>)["href"]).toBe("https://example.com");
    }
  });

  test("mixed marks in paragraph", () => {
    const result = parseMarkdown("hello **bold** and *italic*");
    const para = result.content[0]!;
    if (isBlockNode(para)) {
      // Should have: "hello " (plain), "bold" (bold), " and " (plain), "italic" (italic)
      expect(para.content.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("parseMarkdown: blockquote", () => {
  test("simple blockquote", () => {
    const result = parseMarkdown("> quoted text");
    const bq = result.content[0]!;
    expect(isBlockNode(bq) && bq.type === "blockquote").toBe(true);
    if (isBlockNode(bq)) {
      expect(bq.content.length).toBe(1);
      const para = bq.content[0]!;
      expect(isBlockNode(para) && para.type === "paragraph").toBe(true);
    }
  });
});

describe("parseMarkdown: lists", () => {
  test("unordered list", () => {
    const result = parseMarkdown("- item 1\n- item 2");
    const list = result.content[0]!;
    expect(isBlockNode(list) && list.type === "bullet_list").toBe(true);
    if (isBlockNode(list)) {
      expect(list.content.length).toBe(2);
    }
  });

  test("ordered list", () => {
    const result = parseMarkdown("1. first\n2. second");
    const list = result.content[0]!;
    expect(isBlockNode(list) && list.type === "ordered_list").toBe(true);
    if (isBlockNode(list)) {
      expect(list.content.length).toBe(2);
    }
  });
});

describe("parseMarkdown: code block", () => {
  test("fenced code block", () => {
    const result = parseMarkdown("```js\nconsole.log('hi')\n```");
    const cb = result.content[0]!;
    expect(isBlockNode(cb) && cb.type === "code_block").toBe(true);
    if (isBlockNode(cb)) {
      expect((cb.attrs as Record<string, unknown>)["language"]).toBe("js");
      expect(cb.content.length).toBe(1);
      if (isTextNode(cb.content[0]!)) {
        expect(cb.content[0]!.text).toBe("console.log('hi')");
      }
    }
  });
});

describe("parseMarkdown: horizontal rule", () => {
  test("thematic break", () => {
    const result = parseMarkdown("---");
    const hr = result.content[0]!;
    expect(isBlockNode(hr) && hr.type === "horizontal_rule").toBe(true);
    if (isBlockNode(hr)) {
      expect(hr.atom).toBe(true);
    }
  });
});

describe("parseMarkdown: HTML block", () => {
  test("HTML block preserved", () => {
    const result = parseMarkdown("<div class=\"custom\">content</div>");
    const htmlBlock = result.content[0]!;
    expect(isBlockNode(htmlBlock) && htmlBlock.type === "html_block").toBe(true);
    if (isBlockNode(htmlBlock)) {
      expect((htmlBlock.attrs as Record<string, unknown>)["html"]).toContain("<div");
    }
  });
});

describe("parseMarkdown: GFM table", () => {
  test("simple table", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const result = parseMarkdown(md);
    const table = result.content[0]!;
    expect(isBlockNode(table) && table.type === "table").toBe(true);
    if (isBlockNode(table)) {
      expect(table.content.length).toBe(2); // header + 1 data row
    }
  });
});
