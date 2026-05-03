import { describe, it, expect } from "bun:test";
import {
  blockAt,
  docFromBlocks,
  emptyDoc,
  findInsertionPos,
  findPos,
  insertAfter,
  insertAt,
  insertManyAt,
  insertWithIndex,
  iterBlocks,
  maybeRebalance,
  newBlockId,
  removeBlock,
  updateBlock,
} from "../doc";
import { generateBetween, REBALANCE_THRESHOLD } from "../fractional";
import type { ParagraphBlock } from "../types";

function p(id: string, text: string): Omit<ParagraphBlock, "index"> {
  return { id, type: "p", runs: [{ text }] };
}

describe("DocState CRUD", () => {
  it("emptyDoc starts empty", () => {
    const d = emptyDoc();
    expect(d.byId.size).toBe(0);
    expect(d.order.length).toBe(0);
  });

  it("docFromBlocks preserves order and assigns sortable indices", () => {
    const d = docFromBlocks([p("a", "1"), p("b", "2"), p("c", "3")]);
    expect(d.order).toEqual(["a", "b", "c"]);
    const indices = d.order.map((id) => d.byId.get(id)!.index);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i - 1]! < indices[i]!).toBe(true);
    }
  });

  it("insertAt at position 0 prepends", () => {
    const d0 = docFromBlocks([p("b", "B")]);
    const d1 = insertAt(d0, 0, p("a", "A"));
    expect(d1.order).toEqual(["a", "b"]);
  });

  it("insertAt at end appends", () => {
    const d0 = docFromBlocks([p("a", "A")]);
    const d1 = insertAt(d0, d0.order.length, p("b", "B"));
    expect(d1.order).toEqual(["a", "b"]);
  });

  it("insertAt in the middle inserts between two blocks", () => {
    const d0 = docFromBlocks([p("a", "A"), p("c", "C")]);
    const d1 = insertAt(d0, 1, p("b", "B"));
    expect(d1.order).toEqual(["a", "b", "c"]);
    const idx = d1.order.map((id) => d1.byId.get(id)!.index);
    expect(idx[0]! < idx[1]!).toBe(true);
    expect(idx[1]! < idx[2]!).toBe(true);
  });

  it("insertAfter places after the named block", () => {
    const d0 = docFromBlocks([p("a", "A"), p("c", "C")]);
    const d1 = insertAfter(d0, "a", p("b", "B"));
    expect(d1.order).toEqual(["a", "b", "c"]);
  });

  it("insertAfter(null, ...) prepends", () => {
    const d0 = docFromBlocks([p("a", "A")]);
    const d1 = insertAfter(d0, null, p("z", "Z"));
    expect(d1.order).toEqual(["z", "a"]);
  });

  it("updateBlock keeps order when index unchanged", () => {
    const d0 = docFromBlocks([p("a", "A"), p("b", "B")]);
    const blockA = d0.byId.get("a")!;
    const d1 = updateBlock(d0, {
      ...blockA,
      runs: [{ text: "A!" }],
    } as ParagraphBlock);
    expect(d1.order).toEqual(d0.order);
    expect(d1.byId.get("a")).not.toBe(blockA);
  });

  it("updateBlock re-sorts when index changes", () => {
    const d0 = docFromBlocks([p("a", "A"), p("b", "B"), p("c", "C")]);
    const cBlock = d0.byId.get("c")!;
    // Move c before a.
    const before = null;
    const after = d0.byId.get("a")!.index;
    const newIndex = generateBetween(before, after);
    const d1 = updateBlock(d0, {
      ...cBlock,
      index: newIndex,
    } as ParagraphBlock);
    expect(d1.order).toEqual(["c", "a", "b"]);
  });

  it("removeBlock drops from byId and order", () => {
    const d0 = docFromBlocks([p("a", "A"), p("b", "B"), p("c", "C")]);
    const d1 = removeBlock(d0, "b");
    expect(d1.order).toEqual(["a", "c"]);
    expect(d1.byId.has("b")).toBe(false);
  });

  it("removeBlock no-ops on unknown id", () => {
    const d0 = docFromBlocks([p("a", "A")]);
    const d1 = removeBlock(d0, "zzz");
    expect(d1).toBe(d0);
  });

  it("findInsertionPos respects sort order", () => {
    const d = docFromBlocks([p("a", "A"), p("b", "B"), p("c", "C")]);
    const beforeAll = "0";
    const between = generateBetween(
      d.byId.get("a")!.index,
      d.byId.get("b")!.index,
    );
    const afterAll = "z";
    expect(findInsertionPos(d, beforeAll)).toBe(0);
    expect(findInsertionPos(d, between)).toBe(1);
    expect(findInsertionPos(d, afterAll)).toBe(3);
  });

  it("findPos / blockAt round-trip", () => {
    const d = docFromBlocks([p("a", "A"), p("b", "B"), p("c", "C")]);
    expect(findPos(d, "b")).toBe(1);
    expect(blockAt(d, 1)?.id).toBe("b");
    expect(findPos(d, "ghost")).toBe(-1);
    expect(blockAt(d, 99)).toBeUndefined();
  });

  it("insertWithIndex throws on duplicate id", () => {
    const d = docFromBlocks([p("a", "A")]);
    expect(() =>
      insertWithIndex(d, {
        ...d.byId.get("a")!,
      }),
    ).toThrow();
  });

  it("insertManyAt distributes n keys evenly inside a gap", () => {
    const d0 = docFromBlocks([p("a", "A"), p("z", "Z")]);
    const news = [p("m", "M"), p("n", "N"), p("o", "O")];
    const d1 = insertManyAt(d0, 1, news);
    expect(d1.order).toEqual(["a", "m", "n", "o", "z"]);
    const idx = d1.order.map((id) => d1.byId.get(id)!.index);
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i - 1]! < idx[i]!).toBe(true);
    }
  });

  it("iterBlocks yields blocks in order", () => {
    const d = docFromBlocks([p("a", "A"), p("b", "B")]);
    const ids = [...iterBlocks(d)].map((b) => b.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("newBlockId returns unique strings", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newBlockId());
    expect(set.size).toBe(1000);
  });

  it("maybeRebalance shortens overlong keys", () => {
    // Construct a doc whose indices include an overlong key.
    const d = docFromBlocks([p("a", "A"), p("b", "B")]);
    const aBlock = d.byId.get("a")!;
    const tall = "a".repeat(REBALANCE_THRESHOLD + 5);
    const tallDoc = updateBlock(d, {
      ...aBlock,
      index: tall,
    } as ParagraphBlock);
    // Make sure it still sorts; depending on `tall` value it may move to end.
    const reb = maybeRebalance(tallDoc);
    for (const b of reb.byId.values()) {
      expect(b.index.length).toBeLessThanOrEqual(REBALANCE_THRESHOLD);
    }
    // Order is preserved relative to the input doc.
    expect(reb.order).toEqual(tallDoc.order);
  });

  it("maybeRebalance returns same doc when no key exceeds threshold", () => {
    const d = docFromBlocks([p("a", "A"), p("b", "B")]);
    const r = maybeRebalance(d);
    expect(r).toBe(d);
  });
});
