import { expect, test } from "bun:test";
import { isRecordLike } from "./IsRecordLike";

test("Handles objects", () => {
  expect(isRecordLike({})).toBe(true);
  expect(isRecordLike({ foo: "bar" })).toBe(true);
  expect(isRecordLike(new String())).toBe(true);
});

test("Handles arrays", () => {
  expect(isRecordLike([])).toBe(true);
});

test("Fails nulls", () => {
  expect(isRecordLike(null)).toBe(false);
  expect(isRecordLike(undefined)).toBe(false);
  expect(isRecordLike(NaN)).toBe(false);
  expect(isRecordLike(0)).toBe(false);
  expect(isRecordLike(false)).toBe(false);
  expect(isRecordLike("")).toBe(false);
});

test("Fails primitives", () => {
  expect(isRecordLike(1)).toBe(false);
  expect(isRecordLike("foo")).toBe(false);
  // @ts-ignore
  expect(isRecordLike()).toBe(false);
  expect(isRecordLike(Symbol.for("test"))).toBe(false);
});
