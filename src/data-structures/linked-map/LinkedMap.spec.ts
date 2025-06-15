import { expect, test } from "bun:test";
import { LinkedMap } from "./LinkedMap";

type Entry = { key: string; value: number };

test("put adds items to the end", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.put({ key: "foo", value: 1 });
  map.put({ key: "bar", value: 2 });
  map.put({ key: "baz", value: 94 });

  expect([...map].map((e) => [e.key, e.value])).toEqual([
    ["foo", 1],
    ["bar", 2],
    ["baz", 94],
  ]);
});

test("putBefore and putAfter work correctly", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.put({ key: "foo", value: 1 });
  map.put({ key: "bar", value: 2 });
  map.put({ key: "baz", value: 94 });

  map.putBefore("bar", { key: "hey", value: 13 }); // insert before "bar"

  expect([...map].map((e) => [e.key, e.value])).toEqual([
    ["foo", 1],
    ["hey", 13],
    ["bar", 2],
    ["baz", 94],
  ]);

  map.putAfter("baz", { key: "zap", value: 42 }); // insert after "baz"

  expect([...map].map((e) => [e.key, e.value])).toEqual([
    ["foo", 1],
    ["hey", 13],
    ["bar", 2],
    ["baz", 94],
    ["zap", 42],
  ]);
});

test("map has access by key", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.put({ key: "foo", value: 1 });
  map.put({ key: "bar", value: 2 });
  map.put({ key: "hey", value: 13 });
  map.put({ key: "baz", value: 94 });

  expect(map.get("baz")?.value).toEqual(94);
  expect(map.get("bar")?.value).toEqual(2);
  expect(map.get("hey")?.value).toEqual(13);
});

test("map has access by index", () => {
  const map = new LinkedMap<Entry, "key">("key");
  map.put({ key: "foo", value: 1 });
  map.put({ key: "bar", value: 2 });
  map.put({ key: "hey", value: 13 });
  map.put({ key: "baz", value: 94 });

  expect(map.at(-1)?.value).toEqual(94);
  expect(map.at(2)?.value).toEqual(13);
  expect(map.at(0)?.value).toEqual(1);
});
