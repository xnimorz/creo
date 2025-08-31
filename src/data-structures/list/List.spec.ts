import { expect, test } from "bun:test";
import { List, ListNode } from "./List";
import { nonNull } from "../maybe/Maybe";

test("insertEnd adds items to the end", () => {
  const listInstance = new List();
  listInstance.insertEnd("1");
  listInstance.insertEnd("2");
  listInstance.insertEnd("3");
  listInstance.insertEnd("4");
  listInstance.insertEnd("5");
  listInstance.insertEnd("6");

  expect(listInstance.at(0)?.value).toBe("1");
  expect(listInstance.at(1)?.value).toBe("2");
  expect(listInstance.at(3)?.value).toBe("4");
  expect(listInstance.at(5)?.value).toBe("6");
});

test("at works with negative values", () => {
  const l = new List<string>();
  l.insertEnd("1");
  l.insertEnd("2");
  l.insertEnd("3");
  l.insertEnd("4");
  l.insertEnd("5");
  l.insertEnd("6");

  expect(l.at(-1)?.value).toBe("6");
  expect(l.at(-5)?.value).toBe("2");
});

test("if at exceeds the length, null to be returned", () => {
  const listInstance = new List();
  listInstance.insertEnd("1");
  listInstance.insertEnd("2");
  listInstance.insertEnd("3");
  listInstance.insertEnd("4");
  listInstance.insertEnd("5");
  listInstance.insertEnd("6");

  expect(listInstance.at(-10)).toBe(null);
  expect(listInstance.at(10)).toBe(null);
});

test("Add to start", () => {
  const listInstance = new List();
  listInstance.insertStart("1");
  listInstance.insertStart("2");
  listInstance.insertStart("3");
  listInstance.insertStart("4");
  listInstance.insertStart("5");
  listInstance.insertStart("6");

  expect(listInstance.at(0)?.value).toBe("6");
  expect(listInstance.at(1)?.value).toBe("5");
  expect(listInstance.at(2)?.value).toBe("4");
  expect(listInstance.at(-3)?.value).toBe("3");
  expect(listInstance.at(-2)?.value).toBe("2");
  expect(listInstance.at(-1)?.value).toBe("1");
});

test("from is a static method which builds a list from an array", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  expect(listInstance.at(-1)?.value).toBe("6");
  expect(listInstance.at(-2)?.value).toBe("5");
  expect(listInstance.at(-3)?.value).toBe("4");
  expect(listInstance.at(2)?.value).toBe("3");
  expect(listInstance.at(1)?.value).toBe("2");
  expect(listInstance.at(0)?.value).toBe("1");
});

test("Iterable", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  let resultString = "";
  for (const item of listInstance) {
    resultString += item.value;
  }

  expect(resultString).toBe("123456");
});

test("Mutating ListNode directly keeps List in correct state", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe("3");

  listNode.insertPrev("10");

  expect(listInstance.at(2)?.value).toBe("10");
  expect(listInstance.at(3)?.value).toBe("3");
});

test("Mutating ListNode.prev directly keeps List in correct state", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe("3");

  listNode.insertPrev("10");

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("12103456");
});

test("Mutating ListNode.next directly keeps List in correct state", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe("3");

  listNode.insertNext("10");

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("12310456");
  expect(listInstance.at(-3)?.value).toBe("4");
  expect(listInstance.at(-4)?.value).toBe("10");
  expect(listInstance.at(-5)?.value).toBe("3");
});

test("Mutating the first item using ListNode directly keeps List in correct state", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  listInstance.at(0)?.insertPrev("test");

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("test123456");
});

test("Mutating the last item using ListNode directly keeps List in correct state", () => {
  const listInstance: List<string> = List.from(["1", "2", "3", "4", "5", "6"]);

  listInstance.at(-1)?.insertNext("test");

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("123456test");
  expect(listInstance.at(-1)?.value).toBe("test");
  expect(listInstance.at(-2)?.value).toBe("6");
});

test("Mutating item in a middle keeps the list correct", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  listInstance.at(-4)?.insertNext("test");

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("123test456");
  expect(listInstance.at(-2)?.value).toBe("5");
  expect(listInstance.at(-4)?.value).toBe("test");
  expect(listInstance.at(-5)?.value).toBe("3");
  expect(listInstance.at(5)?.value).toBe("5");
});

test("First item deletion works correctly", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  listInstance.at(0)!.delete();

  expect(
    Array.from(listInstance)
      .map((i) => i.value)
      .join(""),
  ).toBe("23456");
  expect(listInstance.at(0)?.value).toBe("2");
  expect(listInstance.at(1)?.value).toBe("3");
});

test("addTo returns node", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);

  expect(listInstance.insertEnd("test")).toBe(listInstance.at(-1)!);
  expect(listInstance.insertStart("test2")).toBe(listInstance.at(0)!);
});

test("Adding item in the middle of the list", () => {
  const listInstance = List.from(["1", "2", "3", "4", "5", "6"]);
  const node = listInstance.at(2);
  nonNull(node);
  expect(node.value).toBe("3");
  node.insertNext("123");

  expect([...listInstance].map((i) => i.value)).toEqual([
    "1",
    "2",
    "3",
    "123",
    "4",
    "5",
    "6",
  ]);
});

test("deleting last item works correctly", () => {
  const list = List.from(["1", "2", "3"]);
  const last = list.at(-1)!;

  last.delete();

  expect([...list].map((n) => n.value)).toEqual(["1", "2"]);
  expect(list.at(-1)?.value).toBe("2");
});

test("empty list behaves correctly", () => {
  const list = new List<string>();

  expect(list.at(0)).toBe(undefined!);
  expect(list.at(-1)).toBe(undefined!);
  expect([...list]).toEqual([]);
});

test("deleting middle item keeps list connected", () => {
  const list = List.from(["a", "b", "c", "d"]);
  const middle = list.at(1)!; // "b"

  middle.delete();

  expect([...list].map((n) => n.value)).toEqual(["a", "c", "d"]);
  expect(list.at(1)?.value).toBe("c");
  expect(list.at(-2)?.value).toBe("c");
});

test("isFirst and isLast flags are correct", () => {
  const list = List.from(["x", "y", "z"]);

  const first = list.at(0)!;
  const middle = list.at(1)!;
  const last = list.at(2)!;

  expect(first.isFirst()).toBe(true);
  expect(first.isLast()).toBe(false);

  expect(middle.isFirst()).toBe(false);
  expect(middle.isLast()).toBe(false);

  expect(last.isFirst()).toBe(false);
  expect(last.isLast()).toBe(true);
});

test("deleting all items makes list empty", () => {
  const list = List.from([1, 2, 3]);
  list.at(0)!.delete();
  list.at(0)!.delete();
  list.at(0)!.delete();

  expect([...list]).toEqual([]);
  expect(list.at(0)).toBe(null);
  expect(list.at(-1)).toBe(null);
});

test("deleting single node list works", () => {
  const list = new List<string>();
  const only = list.insertEnd("only");

  only.delete();

  expect([...list]).toEqual([]);
  expect(list.at(0)).toBe(null);
  expect(list.at(-1)).toBe(null);
});

test("insertPrev should insert before the reference node", () => {
  const list = List.from(["a", "b", "c"]);
  const nodeB = list.at(1)!;

  nodeB.insertPrev("X");

  // Correct expected result: a, X, b, c
  expect([...list].map((n) => n.value)).toEqual(["a", "X", "b", "c"]);
});
