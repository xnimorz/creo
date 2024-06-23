import { expect, test } from "bun:test";
import { List, ListNode } from "./CreoList";

test("addToEnd adds items to the end", () => {
  const list = new List();
  list.addToEnd('1');
  list.addToEnd('2');
  list.addToEnd('3');
  list.addToEnd('4');
  list.addToEnd('5');
  list.addToEnd('6');

  expect(list.at(0)?.value).toBe('1');
  expect(list.at(1)?.value).toBe('2');
  expect(list.at(3)?.value).toBe('4');
  expect(list.at(5)?.value).toBe('6');
});

test("at works with negative values", () => {
  const list = new List();
  list.addToEnd('1');
  list.addToEnd('2');
  list.addToEnd('3');
  list.addToEnd('4');
  list.addToEnd('5');
  list.addToEnd('6');

  expect(list.at(-1)?.value).toBe('6');
  expect(list.at(-5)?.value).toBe('2');
});

test("if at exceeds the length, null to be returned", () => {
  const list = new List();
  list.addToEnd('1');
  list.addToEnd('2');
  list.addToEnd('3');
  list.addToEnd('4');
  list.addToEnd('5');
  list.addToEnd('6');

  expect(list.at(-10)).toBe(null);
  expect(list.at(10)).toBe(null);
});

test("Add to start", () => {
  const list = new List();
  list.addToStart('1');
  list.addToStart('2');
  list.addToStart('3');
  list.addToStart('4');
  list.addToStart('5');
  list.addToStart('6');

  expect(list.at(0)?.value).toBe('6');
  expect(list.at(1)?.value).toBe('5');
  expect(list.at(2)?.value).toBe('4');
  expect(list.at(-3)?.value).toBe('3');
  expect(list.at(-2)?.value).toBe('2');
  expect(list.at(-1)?.value).toBe('1');
});

test("from is a static method which builds a list from an array", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  expect(list.at(-1)?.value).toBe('6');
  expect(list.at(-2)?.value).toBe('5');
  expect(list.at(-3)?.value).toBe('4');
  expect(list.at(2)?.value).toBe('3');
  expect(list.at(1)?.value).toBe('2');
  expect(list.at(0)?.value).toBe('1');
});

test("Iterable", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  let resultString = ''
  for (const item of list) {
    resultString += item;
  }

  expect(resultString).toBe('123456');
});

test("Mutating ListNode directly keeps List in correct state", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = list.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.prev = '10';

  expect(list.at(2)?.value).toBe('10');
  expect(list.at(3)?.value).toBe('3');
});

test("Mutating ListNode.prev directly keeps List in correct state", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = list.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.prev = '10';

  expect(Array.from(list).join('')).toBe('12103456');
});

test("Mutating ListNode.next directly keeps List in correct state", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = list.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.next = '10';

  expect(Array.from(list).join('')).toBe('12310456');
  expect(list.at(-3)?.value).toBe('4');
  expect(list.at(-4)?.value).toBe('10');
  expect(list.at(-5)?.value).toBe('3');
});

test("Mutating the first item using ListNode directly keeps List in correct state", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  list.at(0)!.prev = 'test'

  expect(Array.from(list).join('')).toBe('test123456');
});

test("Mutating the last item using ListNode directly keeps List in correct state", () => {
  const list = List.from(['1','2','3','4','5','6']);  

  list.at(-1)!.next = 'test'

  expect(Array.from(list).join('')).toBe('123456test');
  expect(list.at(-1)?.value).toBe('test');
  expect(list.at(-2)?.value).toBe('6');
});

test('Mutating item in a middle keeps the list correct', () => {
  const list = List.from(['1','2','3','4','5','6']);  

  list.at(-4)!.next = 'test'

  expect(Array.from(list).join('')).toBe('123test456');
  expect(list.at(-2)?.value).toBe('5');
  expect(list.at(-4)?.value).toBe('test');
  expect(list.at(-5)?.value).toBe('3');
  expect(list.at(5)?.value).toBe('5');
})

test('First item deletion works correctly', () => {
  const list = List.from(['1','2','3','4','5','6']);  

  list.at(0)!.delete();

  expect(Array.from(list).join('')).toBe('23456');
  expect(list.at(0)?.value).toBe('2');
  expect(list.at(1)?.value).toBe('3');

})