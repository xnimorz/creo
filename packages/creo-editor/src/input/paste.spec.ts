import { describe, test, expect } from "bun:test";
import { pasteToSlice } from "./paste";
import type { PasteData } from "./paste";
import { isBlockNode, isTextNode } from "../model/types";

describe("pasteToSlice", () => {
  test("plain text creates text node", () => {
    const data: PasteData = { html: null, text: "hello world", markdown: null };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBe(1);
    expect(isTextNode(slice.content[0]!)).toBe(true);
    if (isTextNode(slice.content[0]!)) {
      expect(slice.content[0]!.text).toBe("hello world");
    }
  });

  test("multi-paragraph text creates multiple paragraphs", () => {
    const data: PasteData = { html: null, text: "first\n\nsecond", markdown: null };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBe(2);
    expect(isBlockNode(slice.content[0]!)).toBe(true);
    expect(isBlockNode(slice.content[1]!)).toBe(true);
  });

  test("markdown text is detected and parsed", () => {
    const data: PasteData = { html: null, text: "# Title\n\nSome **bold** text", markdown: null };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBeGreaterThanOrEqual(2);
  });

  test("empty paste data returns empty slice", () => {
    const data: PasteData = { html: null, text: null, markdown: null };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBe(0);
  });

  test("empty text returns empty slice", () => {
    const data: PasteData = { html: null, text: "", markdown: null };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBe(0);
  });

  test("non-rich HTML falls back to text", () => {
    // Simple text wrapped in minimal HTML (like browser copy from textarea)
    const data: PasteData = {
      html: "<span>just text</span>",
      text: "just text",
      markdown: null,
    };
    const slice = pasteToSlice(data);
    // Should fall back to text since no block/format tags
    expect(slice.content.length).toBe(1);
  });

  test("markdown-like plain text is parsed as markdown", () => {
    const data: PasteData = {
      html: null,
      text: "- item 1\n- item 2\n- item 3",
      markdown: null,
    };
    const slice = pasteToSlice(data);
    // Should be parsed as a list
    expect(slice.content.length).toBeGreaterThanOrEqual(1);
    if (isBlockNode(slice.content[0]!)) {
      expect(slice.content[0]!.type).toBe("bullet_list");
    }
  });

  test("code block markdown is detected", () => {
    const data: PasteData = {
      html: null,
      text: "```js\nconsole.log('hi')\n```",
      markdown: null,
    };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBeGreaterThanOrEqual(1);
  });

  test("link markdown is detected", () => {
    const data: PasteData = {
      html: null,
      text: "Check [this link](https://example.com) out",
      markdown: null,
    };
    const slice = pasteToSlice(data);
    expect(slice.content.length).toBeGreaterThanOrEqual(1);
  });
});
