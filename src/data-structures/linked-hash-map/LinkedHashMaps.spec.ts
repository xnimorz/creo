import { expect, test } from "bun:test";
import { assertJust } from "../assert/assert";
import { LinkedMap } from "./LinkedHashMap";

test("addToEnd adds items to the end", () => {
  const map = LinkedMap();
  map.addToEnd('foo', 1);
  map.addToEnd('bar', 2);
  map.addToEnd('baz', 94);


  expect([...map]).toEqual([['foo', 1], ['bar', 2], ['baz', 94]]);
});

test("addToEnd and addToStart work together", () => {
  const map = LinkedMap();
  map.addToEnd('foo', 1);
  map.addToEnd('bar', 2);
  map.addToStart('hey', 13);
  map.addToEnd('baz', 94);


  expect([...map]).toEqual([['hey', 13], ['foo', 1], ['bar', 2], ['baz', 94]]);
});

test("map has access by key", () => {
  const map = LinkedMap();
  map.addToEnd('foo', 1);
  map.addToEnd('bar', 2);
  map.addToStart('hey', 13);
  map.addToEnd('baz', 94);


  expect(map.get('baz')).toEqual(94);
  expect(map.get('bar')).toEqual(2);
  expect(map.get('hey')).toEqual(13);
});

test("map has access by index", () => {
  const map = LinkedMap();
  map.addToEnd('foo', 1);
  map.addToEnd('bar', 2);
  map.addToStart('hey', 13);
  map.addToEnd('baz', 94);


  expect(map.at(-1)).toEqual(94);
  expect(map.at(2)).toEqual(2);
  expect(map.at(0)).toEqual(13);
});