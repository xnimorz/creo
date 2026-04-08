import { describe, test, expect } from "bun:test";
import { createSchema, validateContent, validateDocument, isMarkAllowed, isAtomNode } from "./schema";
import { defaultSchema } from "./default-schema";
import { createBlockNode, createTextNode, createMark } from "./types";
import { doc, p, heading, blockquote, ul, ol, li, hr, codeBlock } from "../test-utils/builders";

// ── Schema creation ────────────────────────────────────────────────────

describe("createSchema", () => {
  test("builds node groups", () => {
    const schema = createSchema({
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block" },
      text: { content: "", group: "inline" },
    });
    expect(schema.nodeGroups["block"]?.has("paragraph")).toBe(true);
    expect(schema.nodeGroups["inline"]?.has("text")).toBe(true);
  });

  test("handles multiple groups", () => {
    const schema = createSchema({
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block flow" },
      text: { content: "", group: "inline" },
    });
    expect(schema.nodeGroups["block"]?.has("paragraph")).toBe(true);
    expect(schema.nodeGroups["flow"]?.has("paragraph")).toBe(true);
  });
});

// ── Content validation ─────────────────────────────────────────────────

describe("validateContent", () => {
  test("paragraph with text children is valid", () => {
    const node = createBlockNode("paragraph", {}, [createTextNode("hello")]);
    expect(validateContent(node, defaultSchema)).toBeNull();
  });

  test("paragraph with no children is valid (inline*)", () => {
    const node = createBlockNode("paragraph");
    expect(validateContent(node, defaultSchema)).toBeNull();
  });

  test("doc with paragraph child is valid", () => {
    const node = doc(p("hello"));
    expect(validateContent(node, defaultSchema)).toBeNull();
  });

  test("doc with no children fails (block+)", () => {
    const node = createBlockNode("doc");
    const err = validateContent(node, defaultSchema);
    expect(err).toContain("at least 1");
  });

  test("leaf node with children fails", () => {
    const node = createBlockNode("horizontal_rule", {}, [createTextNode("bad")]);
    const err = validateContent(node, defaultSchema);
    expect(err).toContain("leaf");
  });

  test("unknown node type returns error", () => {
    const node = createBlockNode("nonexistent");
    const err = validateContent(node, defaultSchema);
    expect(err).toContain("Unknown node type");
  });

  test("doc with text child fails (requires block)", () => {
    const node = createBlockNode("doc", {}, [createTextNode("bad")]);
    const err = validateContent(node, defaultSchema);
    expect(err).toContain("cannot contain");
  });

  test("bullet_list with list_item children is valid", () => {
    const node = ul(li(p("item")));
    expect(validateContent(node, defaultSchema)).toBeNull();
  });

  test("bullet_list with paragraph child fails", () => {
    const node = createBlockNode("bullet_list", {}, [
      createBlockNode("paragraph", {}, [createTextNode("bad")]),
    ]);
    const err = validateContent(node, defaultSchema);
    expect(err).toContain("cannot contain");
  });
});

// ── Mark validation ────────────────────────────────────────────────────

describe("isMarkAllowed", () => {
  test("marks allowed on paragraph (marks: _)", () => {
    expect(isMarkAllowed("bold", "paragraph", defaultSchema)).toBe(true);
    expect(isMarkAllowed("italic", "paragraph", defaultSchema)).toBe(true);
    expect(isMarkAllowed("link", "paragraph", defaultSchema)).toBe(true);
  });

  test("marks not allowed on code_block (marks: empty)", () => {
    expect(isMarkAllowed("bold", "code_block", defaultSchema)).toBe(false);
    expect(isMarkAllowed("italic", "code_block", defaultSchema)).toBe(false);
  });

  test("unknown node type returns false", () => {
    expect(isMarkAllowed("bold", "nonexistent", defaultSchema)).toBe(false);
  });
});

// ── Atom nodes ─────────────────────────────────────────────────────────

describe("isAtomNode", () => {
  test("horizontal_rule is atom", () => {
    expect(isAtomNode("horizontal_rule", defaultSchema)).toBe(true);
  });

  test("image is atom", () => {
    expect(isAtomNode("image", defaultSchema)).toBe(true);
  });

  test("paragraph is not atom", () => {
    expect(isAtomNode("paragraph", defaultSchema)).toBe(false);
  });

  test("atomic_block is atom", () => {
    expect(isAtomNode("atomic_block", defaultSchema)).toBe(true);
  });
});

// ── Document validation ────────────────────────────────────────────────

describe("validateDocument", () => {
  test("valid document passes", () => {
    const document = doc(
      p("Hello ", createTextNode("world", [createMark("bold")])),
      heading({ level: 2 }, "Title"),
      blockquote(p("quote")),
      ul(li(p("item 1")), li(p("item 2"))),
    );
    const errors = validateDocument(document, defaultSchema);
    expect(errors).toEqual([]);
  });

  test("reports nested errors", () => {
    const document = createBlockNode("doc", {}, [
      createBlockNode("paragraph", {}, [
        createBlockNode("paragraph"), // block inside inline context
      ]),
    ]);
    const errors = validateDocument(document, defaultSchema);
    expect(errors.length).toBeGreaterThan(0);
  });

  test("reports unknown mark types", () => {
    const document = doc(
      createBlockNode("paragraph", {}, [
        createTextNode("hello", [createMark("nonexistent_mark")]),
      ]),
    );
    const errors = validateDocument(document, defaultSchema);
    expect(errors.some(e => e.includes("Unknown mark type"))).toBe(true);
  });
});
