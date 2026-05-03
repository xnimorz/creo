import { describe, it, expect } from "bun:test";
import {
  generateBetween,
  generateN,
  needsRebalance,
  rebalance,
  REBALANCE_THRESHOLD,
} from "../fractional";

describe("generateBetween", () => {
  it("returns a midpoint when both bounds are null", () => {
    const k = generateBetween(null, null);
    expect(k.length).toBe(1);
    expect(k > "0").toBe(true);
    expect(k < "z").toBe(true);
  });

  it("returns a key < b when a is null", () => {
    const k = generateBetween(null, "h");
    expect(k < "h").toBe(true);
  });

  it("returns a key > a when b is null", () => {
    const k = generateBetween("h", null);
    expect(k > "h").toBe(true);
  });

  it("returns a key strictly between adjacent keys", () => {
    const k = generateBetween("a", "b");
    expect(k > "a").toBe(true);
    expect(k < "b").toBe(true);
  });

  it("returns a key strictly between same-prefix keys", () => {
    const k = generateBetween("aa", "ab");
    expect(k > "aa").toBe(true);
    expect(k < "ab").toBe(true);
  });

  it("descends when adjacent at every depth", () => {
    // 'A' and 'B' are adjacent in alphabet; the result must extend past 'A'.
    const k = generateBetween("A", "B");
    expect(k > "A").toBe(true);
    expect(k < "B").toBe(true);
    expect(k.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when a >= b", () => {
    expect(() => generateBetween("c", "b")).toThrow();
    expect(() => generateBetween("c", "c")).toThrow();
  });

  it("survives 10k random insert-between operations and stays sorted", () => {
    let keys: string[] = [generateBetween(null, null)];
    for (let i = 0; i < 10000; i++) {
      // pick a random gap
      const pos = Math.floor(Math.random() * (keys.length + 1));
      const before = pos === 0 ? null : keys[pos - 1]!;
      const after = pos === keys.length ? null : keys[pos]!;
      const k = generateBetween(before, after);
      // assert local order
      if (before != null) expect(k > before).toBe(true);
      if (after != null) expect(k < after).toBe(true);
      keys.splice(pos, 0, k);
    }
    // verify global sort
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1]! < keys[i]!).toBe(true);
    }
  });

  it("never produces duplicates under 10k random midpoint stress", () => {
    let a = generateBetween(null, null);
    let b = generateBetween(a, null);
    const seen = new Set<string>([a, b]);
    for (let i = 0; i < 10000; i++) {
      const k = generateBetween(a, b);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      // shrink the gap toward a to amplify length growth
      b = k;
    }
  });
});

describe("generateN", () => {
  it("returns an empty list for n=0", () => {
    expect(generateN(null, null, 0)).toEqual([]);
  });

  it("returns one key for n=1", () => {
    const r = generateN(null, null, 1);
    expect(r.length).toBe(1);
  });

  it("returns n strictly-ascending keys", () => {
    const keys = generateN(null, null, 50);
    expect(keys.length).toBe(50);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1]! < keys[i]!).toBe(true);
    }
  });

  it("respects bounds when both are provided", () => {
    const keys = generateN("h", "k", 30);
    expect(keys.length).toBe(30);
    for (const k of keys) {
      expect(k > "h").toBe(true);
      expect(k < "k").toBe(true);
    }
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1]! < keys[i]!).toBe(true);
    }
  });

  it("respects bounds when only b is provided", () => {
    const keys = generateN(null, "h", 10);
    for (const k of keys) expect(k < "h").toBe(true);
  });
});

describe("rebalance", () => {
  it("flags rebalance once a key exceeds threshold", () => {
    expect(needsRebalance(["short", "alsoshort"])).toBe(false);
    const tall = "a".repeat(REBALANCE_THRESHOLD + 1);
    expect(needsRebalance([tall])).toBe(true);
  });

  it("rebalance(n) returns n strictly-ascending short keys", () => {
    const k = rebalance(100);
    expect(k.length).toBe(100);
    for (let i = 1; i < k.length; i++) expect(k[i - 1]! < k[i]!).toBe(true);
    for (const x of k) expect(x.length).toBeLessThanOrEqual(4);
  });
});
