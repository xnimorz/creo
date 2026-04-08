import { describe, test, expect } from "bun:test";
import {
  createSelection,
  selFrom,
  selTo,
  selIsEmpty,
  createMultiSelection,
  singleSelection,
  mapSelection,
} from "./selection";
import { createPos } from "../model/types";

describe("Selection", () => {
  test("creates cursor (collapsed) selection", () => {
    const sel = createSelection(5);
    expect(sel.anchor as number).toBe(5);
    expect(sel.head as number).toBe(5);
    expect(selIsEmpty(sel)).toBe(true);
  });

  test("creates range selection", () => {
    const sel = createSelection(3, 7);
    expect(sel.anchor as number).toBe(3);
    expect(sel.head as number).toBe(7);
    expect(selIsEmpty(sel)).toBe(false);
  });

  test("selFrom/selTo with forward selection", () => {
    const sel = createSelection(3, 7);
    expect(selFrom(sel) as number).toBe(3);
    expect(selTo(sel) as number).toBe(7);
  });

  test("selFrom/selTo with backward selection", () => {
    const sel = createSelection(7, 3);
    expect(selFrom(sel) as number).toBe(3);
    expect(selTo(sel) as number).toBe(7);
  });

  test("accepts Pos branded values", () => {
    const sel = createSelection(createPos(1), createPos(5));
    expect(sel.anchor as number).toBe(1);
    expect(sel.head as number).toBe(5);
  });
});

describe("MultiSelection", () => {
  test("creates single cursor", () => {
    const multi = singleSelection(5);
    expect(multi.ranges.length).toBe(1);
    expect(multi.primary).toBe(0);
    expect(multi.ranges[0]!.anchor as number).toBe(5);
  });

  test("sorts ranges by position", () => {
    const multi = createMultiSelection([
      createSelection(10),
      createSelection(3),
      createSelection(7),
    ]);
    expect(multi.ranges[0]!.anchor as number).toBe(3);
    expect(multi.ranges[1]!.anchor as number).toBe(7);
    expect(multi.ranges[2]!.anchor as number).toBe(10);
  });

  test("merges overlapping ranges", () => {
    const multi = createMultiSelection([
      createSelection(1, 5),
      createSelection(3, 8),
    ]);
    expect(multi.ranges.length).toBe(1);
    expect(selFrom(multi.ranges[0]!) as number).toBe(1);
    expect(selTo(multi.ranges[0]!) as number).toBe(8);
  });

  test("merges adjacent ranges (touching)", () => {
    const multi = createMultiSelection([
      createSelection(1, 5),
      createSelection(5, 8),
    ]);
    expect(multi.ranges.length).toBe(1);
    expect(selFrom(multi.ranges[0]!) as number).toBe(1);
    expect(selTo(multi.ranges[0]!) as number).toBe(8);
  });

  test("keeps non-overlapping ranges separate", () => {
    const multi = createMultiSelection([
      createSelection(1, 3),
      createSelection(5, 8),
    ]);
    expect(multi.ranges.length).toBe(2);
  });

  test("throws on empty ranges", () => {
    expect(() => createMultiSelection([])).toThrow("at least one range");
  });

  test("throws on invalid primary index", () => {
    expect(() => createMultiSelection([createSelection(1)], 5)).toThrow("out of range");
  });

  test("adjusts primary when ranges are merged", () => {
    const multi = createMultiSelection([
      createSelection(1, 5),
      createSelection(3, 8),
    ], 1);
    // After merge, only 1 range exists, primary clamped
    expect(multi.primary).toBe(0);
  });
});

describe("mapSelection", () => {
  test("maps positions through a mapping function", () => {
    const sel = createSelection(3, 7);
    const mapped = mapSelection(sel, (pos) => createPos((pos as number) + 2));
    expect(mapped.anchor as number).toBe(5);
    expect(mapped.head as number).toBe(9);
  });
});
