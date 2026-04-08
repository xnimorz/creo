import { describe, test, expect } from "bun:test";
import {
  createPos,
  createBlockNode,
  createTextNode,
  createMark,
  nodeSize,
  contentSize,
  isBlockNode,
  isTextNode,
  nodesEqual,
  marksEqual,
  createSlice,
  emptySlice,
} from "./types";
import type { BlockNode, TextNode, Mark } from "./types";

// ── Node creation ──────────────────────────────────────────────────────

describe("createTextNode", () => {
  test("creates a text node with correct fields", () => {
    const node = createTextNode("hello");
    expect(node.kind).toBe("text");
    expect(node.type).toBe("text");
    expect(node.text).toBe("hello");
    expect(node.marks).toEqual([]);
  });

  test("creates a text node with marks", () => {
    const bold = createMark("bold");
    const node = createTextNode("hello", [bold]);
    expect(node.marks).toEqual([bold]);
  });

  test("throws on empty text", () => {
    expect(() => createTextNode("")).toThrow("Text nodes must have non-empty text");
  });
});

describe("createBlockNode", () => {
  test("creates a block node with defaults", () => {
    const node = createBlockNode("paragraph");
    expect(node.kind).toBe("block");
    expect(node.type).toBe("paragraph");
    expect(node.attrs).toEqual({});
    expect(node.content).toEqual([]);
    expect(node.marks).toEqual([]);
  });

  test("creates a heading with attrs", () => {
    const node = createBlockNode("heading", { level: 2 });
    expect(node.attrs).toEqual({ level: 2 });
  });

  test("creates a node with children", () => {
    const text = createTextNode("hello");
    const node = createBlockNode("paragraph", {}, [text]);
    expect(node.content).toEqual([text]);
    expect(node.content.length).toBe(1);
  });
});

describe("createMark", () => {
  test("creates mark with no attrs", () => {
    const mark = createMark("bold");
    expect(mark.type).toBe("bold");
    expect(mark.attrs).toEqual({});
  });

  test("creates link mark with attrs", () => {
    const mark = createMark("link", { href: "https://example.com" });
    expect(mark.type).toBe("link");
    expect(mark.attrs).toEqual({ href: "https://example.com" });
  });
});

// ── Type guards ────────────────────────────────────────────────────────

describe("type guards", () => {
  test("isBlockNode", () => {
    const block = createBlockNode("paragraph");
    const text = createTextNode("hello");
    expect(isBlockNode(block)).toBe(true);
    expect(isBlockNode(text)).toBe(false);
  });

  test("isTextNode", () => {
    const block = createBlockNode("paragraph");
    const text = createTextNode("hello");
    expect(isTextNode(text)).toBe(true);
    expect(isTextNode(block)).toBe(false);
  });
});

// ── Node size ──────────────────────────────────────────────────────────

describe("nodeSize", () => {
  test("text node size = text length", () => {
    expect(nodeSize(createTextNode("abc")) as number).toBe(3);
    expect(nodeSize(createTextNode("a")) as number).toBe(1);
  });

  test("atom block node size = 1", () => {
    expect(nodeSize(createBlockNode("horizontal_rule", {}, [], [], true)) as number).toBe(1);
  });

  test("empty non-atom block = 2 (open + close)", () => {
    expect(nodeSize(createBlockNode("paragraph")) as number).toBe(2);
  });

  test("block with text child = 2 + text length", () => {
    const p = createBlockNode("paragraph", {}, [createTextNode("abc")]);
    expect(nodeSize(p) as number).toBe(5); // 1 + 3 + 1
  });

  test("nested blocks", () => {
    const text = createTextNode("hi");
    const p = createBlockNode("paragraph", {}, [text]);
    const doc = createBlockNode("doc", {}, [p]);
    // doc: 1 + (p: 1 + (hi: 2) + 1) + 1 = 1 + 4 + 1 = 6
    expect(nodeSize(doc) as number).toBe(6);
  });

  test("multiple children", () => {
    const p1 = createBlockNode("paragraph", {}, [createTextNode("ab")]);
    const p2 = createBlockNode("paragraph", {}, [createTextNode("cd")]);
    const doc = createBlockNode("doc", {}, [p1, p2]);
    // doc: 1 + (p1: 1+2+1) + (p2: 1+2+1) + 1 = 1 + 4 + 4 + 1 = 10
    expect(nodeSize(doc) as number).toBe(10);
  });
});

describe("contentSize", () => {
  test("empty block = 0", () => {
    expect(contentSize(createBlockNode("paragraph")) as number).toBe(0);
  });

  test("block with text child = text length", () => {
    const p = createBlockNode("paragraph", {}, [createTextNode("abc")]);
    expect(contentSize(p) as number).toBe(3);
  });

  test("block with nested block = child size", () => {
    const p = createBlockNode("paragraph", {}, [createTextNode("hi")]);
    const doc = createBlockNode("doc", {}, [p]);
    expect(contentSize(doc) as number).toBe(4); // p size = 1+2+1 = 4
  });
});

// ── Marks equality ─────────────────────────────────────────────────────

describe("marksEqual", () => {
  test("empty marks are equal", () => {
    expect(marksEqual([], [])).toBe(true);
  });

  test("same marks are equal", () => {
    const a = [createMark("bold"), createMark("italic")];
    const b = [createMark("bold"), createMark("italic")];
    expect(marksEqual(a, b)).toBe(true);
  });

  test("different marks are not equal", () => {
    const a = [createMark("bold")];
    const b = [createMark("italic")];
    expect(marksEqual(a, b)).toBe(false);
  });

  test("different length marks are not equal", () => {
    const a = [createMark("bold")];
    const b = [createMark("bold"), createMark("italic")];
    expect(marksEqual(a, b)).toBe(false);
  });

  test("marks with different attrs are not equal", () => {
    const a = [createMark("link", { href: "a" })];
    const b = [createMark("link", { href: "b" })];
    expect(marksEqual(a, b)).toBe(false);
  });
});

// ── Node equality ──────────────────────────────────────────────────────

describe("nodesEqual", () => {
  test("identical text nodes", () => {
    const a = createTextNode("hello");
    const b = createTextNode("hello");
    expect(nodesEqual(a, b)).toBe(true);
  });

  test("different text", () => {
    const a = createTextNode("hello");
    const b = createTextNode("world");
    expect(nodesEqual(a, b)).toBe(false);
  });

  test("text vs block", () => {
    const a = createTextNode("hello");
    const b = createBlockNode("paragraph");
    expect(nodesEqual(a, b)).toBe(false);
  });

  test("identical block nodes", () => {
    const a = createBlockNode("paragraph", {}, [createTextNode("hi")]);
    const b = createBlockNode("paragraph", {}, [createTextNode("hi")]);
    expect(nodesEqual(a, b)).toBe(true);
  });

  test("blocks with different attrs", () => {
    const a = createBlockNode("heading", { level: 1 });
    const b = createBlockNode("heading", { level: 2 });
    expect(nodesEqual(a, b)).toBe(false);
  });

  test("blocks with different children", () => {
    const a = createBlockNode("paragraph", {}, [createTextNode("a")]);
    const b = createBlockNode("paragraph", {}, [createTextNode("b")]);
    expect(nodesEqual(a, b)).toBe(false);
  });

  test("blocks with different child count", () => {
    const a = createBlockNode("paragraph", {}, [createTextNode("a")]);
    const b = createBlockNode("paragraph", {}, [createTextNode("a"), createTextNode("b")]);
    expect(nodesEqual(a, b)).toBe(false);
  });

  test("deep equality", () => {
    const mk = () =>
      createBlockNode("doc", {}, [
        createBlockNode("paragraph", {}, [
          createTextNode("hello", [createMark("bold")]),
          createTextNode(" world"),
        ]),
        createBlockNode("heading", { level: 2 }, [createTextNode("title")]),
      ]);
    expect(nodesEqual(mk(), mk())).toBe(true);
  });
});

// ── Slice ──────────────────────────────────────────────────────────────

describe("Slice", () => {
  test("emptySlice has empty content", () => {
    expect(emptySlice.content).toEqual([]);
    expect(emptySlice.openStart).toBe(0);
    expect(emptySlice.openEnd).toBe(0);
  });

  test("createSlice with defaults", () => {
    const s = createSlice([createTextNode("hi")]);
    expect(s.content.length).toBe(1);
    expect(s.openStart).toBe(0);
    expect(s.openEnd).toBe(0);
  });

  test("createSlice with open ends", () => {
    const s = createSlice([createTextNode("hi")], 1, 1);
    expect(s.openStart).toBe(1);
    expect(s.openEnd).toBe(1);
  });
});

// ── Pos branding ───────────────────────────────────────────────────────

describe("Pos branding", () => {
  test("createPos produces a number", () => {
    const pos = createPos(5);
    expect(pos as number).toBe(5);
    expect(typeof pos).toBe("number");
  });

  test("positions can be compared", () => {
    const a = createPos(3);
    const b = createPos(5);
    expect((a as number) < (b as number)).toBe(true);
  });
});
