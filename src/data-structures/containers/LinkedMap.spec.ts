import { expect, test } from "bun:test";
import { LinkedMap } from "./data-containers";

type Entry = { key: string; value: number };

test("put adds items to the end", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.insertEnd({ key: "foo", value: 1 });
  map.insertEnd({ key: "bar", value: 2 });
  map.insertEnd({ key: "baz", value: 94 });

  expect([...map].map((e) => [e.v.key, e.v.value])).toEqual([
    ["foo", 1],
    ["bar", 2],
    ["baz", 94],
  ]);
});

test("putBefore and putAfter work correctly", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.insertEnd({ key: "foo", value: 1 });
  map.insertEnd({ key: "bar", value: 2 });
  map.insertEnd({ key: "baz", value: 94 });

  map.insertPrev(map.get("bar")!, { key: "hey", value: 13 }); // insert before "bar"

  expect([...map].map((e) => [e.v.key, e.v.value])).toEqual([
    ["foo", 1],
    ["hey", 13],
    ["bar", 2],
    ["baz", 94],
  ]);

  map.insertNext(map.get("baz")!, { key: "zap", value: 42 }); // insert after "baz"

  expect([...map].map((e) => [e.v.key, e.v.value])).toEqual([
    ["foo", 1],
    ["hey", 13],
    ["bar", 2],
    ["baz", 94],
    ["zap", 42],
  ]);
});

test("map has access by key", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.insertEnd({ key: "foo", value: 1 });
  map.insertEnd({ key: "bar", value: 2 });
  map.insertEnd({ key: "hey", value: 13 });
  map.insertEnd({ key: "baz", value: 94 });

  expect(map.get("baz")?.v.value).toEqual(94);
  expect(map.get("bar")?.v.value).toEqual(2);
  expect(map.get("hey")?.v.value).toEqual(13);
});

test("map has access by index", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.insertEnd({ key: "foo", value: 1 });
  map.insertEnd({ key: "bar", value: 2 });
  map.insertEnd({ key: "hey", value: 13 });
  map.insertEnd({ key: "baz", value: 94 });

  expect(map.at(-1)?.v.value).toEqual(94);
  expect(map.at(2)?.v.value).toEqual(13);
  expect(map.at(0)?.v.value).toEqual(1);
});
