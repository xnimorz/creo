import { describe, expect, it } from "bun:test";
import { HeightIndex } from "../heightIndex";

describe("HeightIndex", () => {
  it("starts with all-estimated heights", () => {
    const idx = new HeightIndex(10, 20);
    expect(idx.total()).toBe(200);
    expect(idx.prefix(0)).toBe(0);
    expect(idx.prefix(5)).toBe(100);
    expect(idx.prefix(10)).toBe(200);
  });

  it("setHeight updates the prefix sum", () => {
    const idx = new HeightIndex(5, 10);
    idx.setHeight(2, 50);
    // heights: 10, 10, 50, 10, 10  → total = 90
    expect(idx.total()).toBe(90);
    expect(idx.prefix(2)).toBe(20);
    expect(idx.prefix(3)).toBe(70);
    expect(idx.prefix(5)).toBe(90);
  });

  it("setHeight repeated measurements adjust correctly", () => {
    const idx = new HeightIndex(3, 10);
    idx.setHeight(1, 30);
    expect(idx.total()).toBe(50);
    idx.setHeight(1, 5);
    expect(idx.total()).toBe(25);
    idx.setHeight(1, 10);
    expect(idx.total()).toBe(30);
  });

  it("findIndexAtY clamps to range", () => {
    const idx = new HeightIndex(4, 25);
    expect(idx.findIndexAtY(-5)).toBe(0);
    expect(idx.findIndexAtY(0)).toBe(0);
    expect(idx.findIndexAtY(24)).toBe(0);
    expect(idx.findIndexAtY(25)).toBe(1);
    expect(idx.findIndexAtY(99)).toBe(3);
    expect(idx.findIndexAtY(99999)).toBe(3);
  });

  it("findIndexAtY scales to large doc with stochastic measurements", () => {
    const N = 100_000;
    const idx = new HeightIndex(N, 30);
    // Measure a random scattering of blocks with heights 1..200.
    const measured = new Map<number, number>();
    for (let trial = 0; trial < 200; trial++) {
      const i = Math.floor(Math.random() * N);
      const h = 1 + Math.floor(Math.random() * 200);
      idx.setHeight(i, h);
      measured.set(i, h);
    }
    // Spot-check: pick a y, lookup index, ensure prefix(idx) <= y < prefix(idx+1).
    for (let trial = 0; trial < 50; trial++) {
      const y = Math.floor(Math.random() * idx.total());
      const i = idx.findIndexAtY(y);
      expect(idx.prefix(i)).toBeLessThanOrEqual(y);
      expect(idx.prefix(i + 1)).toBeGreaterThan(y);
    }
  });

  it("resize shrinks while preserving measurements in the kept slice", () => {
    const idx = new HeightIndex(5, 10);
    idx.setHeight(0, 100);
    idx.setHeight(3, 100);
    expect(idx.total()).toBe(230); // 100 + 10 + 10 + 100 + 10
    idx.resize(3);
    // heights: 100, 10, 10  → 120
    expect(idx.total()).toBe(120);
    expect(idx.prefix(3)).toBe(120);
  });

  it("resize grows by appending estimated heights", () => {
    const idx = new HeightIndex(2, 10);
    idx.setHeight(0, 50);
    idx.resize(5);
    // heights: 50, 10, 10, 10, 10 → 90
    expect(idx.total()).toBe(90);
  });
});
