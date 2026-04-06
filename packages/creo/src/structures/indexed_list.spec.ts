import { describe, it, expect, beforeEach } from "bun:test";
import { IndexedList } from "./indexed_list";

function toArray<T>(list: IndexedList<T>): T[] {
  return [...list];
}

describe("IndexedList", () => {
  let list: IndexedList<string>;

  beforeEach(() => {
    list = new IndexedList<string>();
  });

  // -------------------------------------------------------------------
  // push
  // -------------------------------------------------------------------

  describe("push", () => {
    it("appends items in order", () => {
      list.push("a");
      list.push("b");
      list.push("c");
      expect(toArray(list)).toEqual(["a", "b", "c"]);
      expect(list.length).toBe(3);
    });

    it("is a no-op for duplicate items", () => {
      list.push("a");
      list.push("a");
      expect(list.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // unshift
  // -------------------------------------------------------------------

  describe("unshift", () => {
    it("inserts at the front", () => {
      list.push("b");
      list.unshift("a");
      expect(toArray(list)).toEqual(["a", "b"]);
    });

    it("is a no-op for duplicates", () => {
      list.push("a");
      list.unshift("a");
      expect(list.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // insertAfter
  // -------------------------------------------------------------------

  describe("insertAfter", () => {
    it("inserts after a reference item", () => {
      list.push("a");
      list.push("c");
      list.insertAfter("a", "b");
      expect(toArray(list)).toEqual(["a", "b", "c"]);
    });

    it("appends if ref not found", () => {
      list.push("a");
      list.insertAfter("missing", "b");
      expect(toArray(list)).toEqual(["a", "b"]);
    });

    it("is a no-op for duplicate item", () => {
      list.push("a");
      list.push("b");
      list.insertAfter("a", "b");
      expect(list.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------

  describe("delete", () => {
    it("removes an item", () => {
      list.push("a");
      list.push("b");
      list.push("c");
      list.delete("b");
      expect(toArray(list)).toEqual(["a", "c"]);
      expect(list.has("b")).toBe(false);
    });

    it("no-op for missing item", () => {
      list.push("a");
      list.delete("z");
      expect(list.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // has / first / last / at
  // -------------------------------------------------------------------

  describe("accessors", () => {
    it("has returns membership", () => {
      list.push("x");
      expect(list.has("x")).toBe(true);
      expect(list.has("y")).toBe(false);
    });

    it("first / last", () => {
      list.push("a");
      list.push("b");
      expect(list.first()).toBe("a");
      expect(list.last()).toBe("b");
    });

    it("at returns positional item", () => {
      list.push("a");
      list.push("b");
      list.push("c");
      expect(list.at(0)).toBe("a");
      expect(list.at(1)).toBe("b");
      expect(list.at(2)).toBe("c");
      expect(list.at(3)).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------

  describe("clear", () => {
    it("empties the list", () => {
      list.push("a");
      list.push("b");
      list.clear();
      expect(list.length).toBe(0);
      expect(toArray(list)).toEqual([]);
      expect(list.has("a")).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // upsert
  // -------------------------------------------------------------------

  describe("upsert", () => {
    it("replaces an existing item at position", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.upsert(1, "B");

      expect(toArray(list)).toEqual(["a", "B", "c"]);
      expect(list.length).toBe(3);
      expect(list.has("B")).toBe(true);
      expect(list.has("b")).toBe(false);
    });

    it("replaces the first item", () => {
      list.push("a");
      list.push("b");

      list.upsert(0, "A");

      expect(toArray(list)).toEqual(["A", "b"]);
      expect(list.has("A")).toBe(true);
      expect(list.has("a")).toBe(false);
    });

    it("replaces the last item", () => {
      list.push("a");
      list.push("b");

      list.upsert(1, "B");

      expect(toArray(list)).toEqual(["a", "B"]);
    });

    it("appends when position equals length (no item at that index)", () => {
      list.push("a");
      list.push("b");

      list.upsert(2, "c");

      expect(toArray(list)).toEqual(["a", "b", "c"]);
      expect(list.length).toBe(3);
    });

    it("appends when position exceeds length", () => {
      list.push("a");

      list.upsert(100, "z");

      expect(toArray(list)).toEqual(["a", "z"]);
      expect(list.length).toBe(2);
    });

    it("works on an empty list", () => {
      list.upsert(0, "x");

      expect(toArray(list)).toEqual(["x"]);
      expect(list.length).toBe(1);
    });

    it("works on an empty list with index > 0", () => {
      list.upsert(5, "x");

      expect(toArray(list)).toEqual(["x"]);
      expect(list.length).toBe(1);
    });

    it("preserves surrounding links after replace", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.upsert(1, "B");

      // Verify navigation still works
      const node = list.getNode("B");
      expect(node?.getPrev()?.v).toBe("a");
      expect(node?.getNext()?.v).toBe("c");
    });

    it("old item is no longer findable by getNode", () => {
      list.push("a");
      list.push("b");

      list.upsert(1, "B");

      expect(list.getNode("b")).toBeUndefined();
      expect(list.getNode("B")).toBeDefined();
    });

    it("can upsert multiple positions sequentially", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.upsert(0, "X");
      list.upsert(2, "Z");

      expect(toArray(list)).toEqual(["X", "b", "Z"]);
    });

    it("replaced item can be deleted afterwards", () => {
      list.push("a");
      list.push("b");

      list.upsert(1, "B");
      list.delete("B");

      expect(toArray(list)).toEqual(["a"]);
      expect(list.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // swap
  // -------------------------------------------------------------------

  describe("swap", () => {
    it("swaps two items in the middle", () => {
      list.push("a");
      list.push("b");
      list.push("c");
      list.push("d");

      list.swap("b", "c");

      expect(toArray(list)).toEqual(["a", "c", "b", "d"]);
    });

    it("swaps head and tail", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.swap("a", "c");

      expect(toArray(list)).toEqual(["c", "b", "a"]);
    });

    it("swaps adjacent items", () => {
      list.push("a");
      list.push("b");

      list.swap("a", "b");

      expect(toArray(list)).toEqual(["b", "a"]);
    });

    it("preserves length", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.swap("a", "c");

      expect(list.length).toBe(3);
    });

    it("updates identity map — has() works after swap", () => {
      list.push("a");
      list.push("b");

      list.swap("a", "b");

      expect(list.has("a")).toBe(true);
      expect(list.has("b")).toBe(true);
    });

    it("updates identity map — getNode points to swapped positions", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.swap("a", "c");

      // "c" is now at head, so its node has no prev
      const nodeC = list.getNode("c");
      expect(nodeC?.isFirst()).toBe(true);
      expect(nodeC?.getNext()?.v).toBe("b");

      // "a" is now at tail, so its node has no next
      const nodeA = list.getNode("a");
      expect(nodeA?.isLast()).toBe(true);
      expect(nodeA?.getPrev()?.v).toBe("b");
    });

    it("no-op if first item is missing", () => {
      list.push("a");
      list.push("b");

      list.swap("z", "b");

      expect(toArray(list)).toEqual(["a", "b"]);
    });

    it("no-op if second item is missing", () => {
      list.push("a");
      list.push("b");

      list.swap("a", "z");

      expect(toArray(list)).toEqual(["a", "b"]);
    });

    it("no-op if both items are missing", () => {
      list.push("a");

      list.swap("x", "y");

      expect(toArray(list)).toEqual(["a"]);
    });

    it("no-op when swapping an item with itself", () => {
      list.push("a");
      list.push("b");

      list.swap("a", "a");

      expect(toArray(list)).toEqual(["a", "b"]);
    });

    it("swapped items can be deleted afterwards", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.swap("a", "c");
      list.delete("c"); // now at position 0

      expect(toArray(list)).toEqual(["b", "a"]);
    });

    it("double swap restores original order", () => {
      list.push("a");
      list.push("b");
      list.push("c");

      list.swap("a", "c");
      list.swap("a", "c");

      expect(toArray(list)).toEqual(["a", "b", "c"]);
    });
  });
});
