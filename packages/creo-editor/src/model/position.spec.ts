import { describe, test, expect } from "bun:test";
import { resolvePos, posAtStartOf, posAtEndOf } from "./position";
import { createPos, createBlockNode, createTextNode, nodeSize } from "./types";
import { doc, p, heading, blockquote } from "../test-utils/builders";
import type { BlockNode } from "./types";

// Helper: build a known document for position tests
//
// Document structure:
//   doc(                     pos 0 (doc open)
//     p("ab"),               pos 1 (p open), 2='a', 3='b', pos 4 (p close)
//     p("cd"),               pos 5 (p open), 6='c', 7='d', pos 8 (p close)
//   )                        pos 9 (doc close)
//
// Total doc size = 10

function makeDoc(): BlockNode {
  return doc(p("ab"), p("cd"));
}

describe("resolvePos", () => {
  const d = makeDoc();

  test("document size is correct", () => {
    expect(nodeSize(d) as number).toBe(10);
  });

  test("position 0 is at doc start (before first paragraph)", () => {
    const resolved = resolvePos(d, createPos(0));
    expect(resolved.depth).toBe(0);
    expect(resolved.parent.type).toBe("doc");
    expect(resolved.index).toBe(0);
    expect(resolved.parentOffset).toBe(0);
  });

  test("position inside first paragraph text", () => {
    // pos 2 = 'a' in first paragraph
    const resolved = resolvePos(d, createPos(2));
    expect(resolved.depth).toBe(1);
    expect(resolved.parent.type).toBe("paragraph");
  });

  test("position between paragraphs", () => {
    // pos 4 = after first paragraph closes, before second opens
    // But actually: doc open=0, p open=1, 'a'=2, 'b'=3, p close=4
    // So pos 4 is at the p close boundary, which means we're back in doc context
    // Let's check: innerPos for doc at pos 4 = 4,
    // first child p has size 4, so cumOffset after first p = 4 = innerPos
    // That means index = 1, nodeAfter = second p
    const resolved = resolvePos(d, createPos(4));
    expect(resolved.parent.type).toBe("doc");
    expect(resolved.index).toBe(1);
  });

  test("throws on negative position", () => {
    expect(() => resolvePos(d, createPos(-1))).toThrow("negative");
  });

  test("throws on position past document", () => {
    expect(() => resolvePos(d, createPos(11))).toThrow("exceeds");
  });

  test("position at document end", () => {
    // pos 8 = end of doc content (after second p closes)
    const resolved = resolvePos(d, createPos(8));
    expect(resolved.parent.type).toBe("doc");
    expect(resolved.index).toBe(2);
  });
});

describe("resolvePos with nested blocks", () => {
  // doc(blockquote(p("ab")))
  // doc open=0, bq open=1, p open=2, 'a'=3, 'b'=4, p close=5, bq close=6, doc close=7
  // Total size = 8
  const d = doc(blockquote(p("ab")));

  test("document size", () => {
    expect(nodeSize(d) as number).toBe(8);
  });

  test("position inside nested paragraph", () => {
    // pos 3 = 'a' inside p inside blockquote
    const resolved = resolvePos(d, createPos(3));
    expect(resolved.depth).toBe(2);
    expect(resolved.parent.type).toBe("paragraph");
  });

  test("position at blockquote level", () => {
    // pos 1 = just inside blockquote (before p)
    // doc innerPos = 1, first child (bq) has size 6
    // 1 > 0 and 1 < 6, so we go inside bq
    // bq innerPos = 0, before p
    const resolved = resolvePos(d, createPos(1));
    expect(resolved.parent.type).toBe("blockquote");
    expect(resolved.index).toBe(0);
  });
});

describe("posAtStartOf / posAtEndOf", () => {
  test("start of paragraph", () => {
    const inner = p("hello");
    const d = doc(inner);
    const pos = posAtStartOf(d, inner);
    // doc: positions are 0-based inside doc content
    // p starts at doc-content offset 0, p open boundary at 0, p content at 1
    // posAtStartOf walks into the p and returns the offset of its first content position
    expect((pos as number)).toBe(2);
  });

  test("end of paragraph", () => {
    const inner = p("hello");
    const d = doc(inner);
    const pos = posAtEndOf(d, inner);
    // p content starts at 2, "hello" is 5 chars, so end = 2 + 5 = 7
    expect((pos as number)).toBe(7);
  });

  test("throws when node not found", () => {
    const d = doc(p("hello"));
    const orphan = p("orphan");
    expect(() => posAtStartOf(d, orphan)).toThrow("not found");
  });
});

describe("resolvePos with empty paragraphs", () => {
  // doc(p(), p("a"))
  // Empty paragraph: size=2 (open+close, non-atom)
  // doc: 2 + 2 + 3 = 7... let me compute:
  //   doc size = 2 + (p1 size) + (p2 size) = 2 + 2 + 3 = 7
  const d = doc(
    createBlockNode("paragraph"),
    p("a"),
  );

  test("document size with empty paragraph", () => {
    // doc: 2 (boundaries) + 2 (empty p) + 3 (p with "a": 2+1) = 7
    expect(nodeSize(d) as number).toBe(7);
  });

  test("position inside empty paragraph", () => {
    // doc content starts at pos 0 within resolvePos
    // Within doc: first child (empty p) starts at offset 0, has size 2
    // pos 0 in doc content => offset 0 within doc, which is the start of first p
    // Entering p: pos 0 < 2 and pos 0 >= 0, so we check if we're inside p
    // Since p is a block with 0 < 0 (innerPos 0 > 0 is false), we stay at doc level
    // pos 1 => offset 1 within doc, first child has size 2, so 1 is inside first p
    const resolved = resolvePos(d, createPos(1));
    expect(resolved.parent.type).toBe("paragraph");
    expect(resolved.depth).toBe(1);
  });
});
