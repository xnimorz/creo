import { describe, test, expect } from "bun:test";
import { serializeMarkdown } from "./serialize";
import { createBlockNode, createTextNode, createMark } from "../model/types";
import { doc, p, heading, blockquote, codeBlock, hr, ul, ol, li, bold, italic, code, strikethrough, link } from "../test-utils/builders";

describe("serializeMarkdown: paragraphs", () => {
  test("single paragraph", () => {
    const d = doc(p("Hello world"));
    expect(serializeMarkdown(d)).toBe("Hello world\n");
  });

  test("multiple paragraphs", () => {
    const d = doc(p("First"), p("Second"));
    expect(serializeMarkdown(d)).toBe("First\n\nSecond\n");
  });

  test("empty paragraph", () => {
    const d = doc(createBlockNode("paragraph"));
    expect(serializeMarkdown(d)).toBe("\n");
  });
});

describe("serializeMarkdown: headings", () => {
  test("h1", () => {
    const d = doc(heading({ level: 1 }, "Title"));
    expect(serializeMarkdown(d)).toBe("# Title\n");
  });

  test("h3", () => {
    const d = doc(heading({ level: 3 }, "Title"));
    expect(serializeMarkdown(d)).toBe("### Title\n");
  });
});

describe("serializeMarkdown: inline marks", () => {
  test("bold", () => {
    const d = doc(p(bold("text")));
    expect(serializeMarkdown(d)).toBe("**text**\n");
  });

  test("italic", () => {
    const d = doc(p(italic("text")));
    expect(serializeMarkdown(d)).toBe("*text*\n");
  });

  test("inline code", () => {
    const d = doc(p(code("text")));
    expect(serializeMarkdown(d)).toBe("`text`\n");
  });

  test("strikethrough", () => {
    const d = doc(p(strikethrough("text")));
    expect(serializeMarkdown(d)).toBe("~~text~~\n");
  });

  test("link", () => {
    const d = doc(p(link("https://example.com", "click")));
    expect(serializeMarkdown(d)).toBe("[click](https://example.com)\n");
  });

  test("mixed inline", () => {
    const d = doc(p("hello ", bold("world")));
    expect(serializeMarkdown(d)).toBe("hello **world**\n");
  });
});

describe("serializeMarkdown: blockquote", () => {
  test("simple blockquote", () => {
    const d = doc(blockquote(p("quoted")));
    expect(serializeMarkdown(d)).toBe("> quoted\n");
  });
});

describe("serializeMarkdown: lists", () => {
  test("unordered list", () => {
    const d = doc(ul(li(p("one")), li(p("two"))));
    expect(serializeMarkdown(d)).toBe("- one\n- two\n");
  });

  test("ordered list", () => {
    const d = doc(ol(li(p("first")), li(p("second"))));
    expect(serializeMarkdown(d)).toBe("1. first\n2. second\n");
  });
});

describe("serializeMarkdown: code block", () => {
  test("fenced code block with language", () => {
    const d = doc(codeBlock({ language: "js" }, "console.log('hi')"));
    expect(serializeMarkdown(d)).toBe("```js\nconsole.log('hi')\n```\n");
  });

  test("fenced code block without language", () => {
    const d = doc(codeBlock("some code"));
    expect(serializeMarkdown(d)).toBe("```\nsome code\n```\n");
  });
});

describe("serializeMarkdown: horizontal rule", () => {
  test("horizontal rule", () => {
    const d = doc(hr());
    expect(serializeMarkdown(d)).toBe("---\n");
  });
});

describe("serializeMarkdown: HTML block", () => {
  test("HTML block preserved", () => {
    const d = doc(createBlockNode("html_block", { html: "<div>content</div>" }, [], [], true));
    expect(serializeMarkdown(d)).toBe("<div>content</div>\n");
  });
});

describe("serializeMarkdown: image", () => {
  test("image", () => {
    const d = doc(createBlockNode("image", { src: "pic.png", alt: "My pic" }, [], [], true));
    expect(serializeMarkdown(d)).toBe("![My pic](pic.png)\n");
  });

  test("image with title", () => {
    const d = doc(createBlockNode("image", { src: "pic.png", alt: "My pic", title: "A picture" }, [], [], true));
    expect(serializeMarkdown(d)).toBe('![My pic](pic.png "A picture")\n');
  });
});
