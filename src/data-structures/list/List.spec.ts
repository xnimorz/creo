import { expect, test } from "bun:test";
import { List, ListNode } from "./List";

test("addToEnd adds items to the end", () => {
  const listInstance = List();
  listInstance.addToEnd('1');
  listInstance.addToEnd('2');
  listInstance.addToEnd('3');
  listInstance.addToEnd('4');
  listInstance.addToEnd('5');
  listInstance.addToEnd('6');

  expect(listInstance.at(0)?.value).toBe('1');
  expect(listInstance.at(1)?.value).toBe('2');
  expect(listInstance.at(3)?.value).toBe('4');
  expect(listInstance.at(5)?.value).toBe('6');
});

test("at works with negative values", () => {
  const l = List();
  l.addToEnd('1');
  l.addToEnd('2');
  l.addToEnd('3');
  l.addToEnd('4');
  l.addToEnd('5');
  l.addToEnd('6');

  expect(l.at(-1)?.value).toBe('6');
  expect(l.at(-5)?.value).toBe('2');
});

test("if at exceeds the length, null to be returned", () => {
  const listInstance = List();
  listInstance.addToEnd('1');
  listInstance.addToEnd('2');
  listInstance.addToEnd('3');
  listInstance.addToEnd('4');
  listInstance.addToEnd('5');
  listInstance.addToEnd('6');

  expect(listInstance.at(-10)).toBe(null);
  expect(listInstance.at(10)).toBe(null);
});

test("Add to start", () => {
  const listInstance = List();
  listInstance.addToStart('1');
  listInstance.addToStart('2');
  listInstance.addToStart('3');
  listInstance.addToStart('4');
  listInstance.addToStart('5');
  listInstance.addToStart('6');

  expect(listInstance.at(0)?.value).toBe('6');
  expect(listInstance.at(1)?.value).toBe('5');
  expect(listInstance.at(2)?.value).toBe('4');
  expect(listInstance.at(-3)?.value).toBe('3');
  expect(listInstance.at(-2)?.value).toBe('2');
  expect(listInstance.at(-1)?.value).toBe('1');
});

test("from is a static method which builds a list from an array", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  expect(listInstance.at(-1)?.value).toBe('6');
  expect(listInstance.at(-2)?.value).toBe('5');
  expect(listInstance.at(-3)?.value).toBe('4');
  expect(listInstance.at(2)?.value).toBe('3');
  expect(listInstance.at(1)?.value).toBe('2');
  expect(listInstance.at(0)?.value).toBe('1');
});

test("Iterable", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  let resultString = ''
  for (const item of listInstance) {
    resultString += item;
  }

  expect(resultString).toBe('123456');
});

test("Mutating ListNode directly keeps List in correct state", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.prev = '10';

  expect(listInstance.at(2)?.value).toBe('10');
  expect(listInstance.at(3)?.value).toBe('3');
});

test("Mutating ListNode.prev directly keeps List in correct state", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.prev = '10';

  expect(Array.from(listInstance).join('')).toBe('12103456');
});

test("Mutating ListNode.next directly keeps List in correct state", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  const listNode: ListNode<string> = listInstance.at(2)!;

  expect(listNode.value).toBe('3');

  listNode.next = '10';

  expect(Array.from(listInstance).join('')).toBe('12310456');
  expect(listInstance.at(-3)?.value).toBe('4');
  expect(listInstance.at(-4)?.value).toBe('10');
  expect(listInstance.at(-5)?.value).toBe('3');
});

test("Mutating the first item using ListNode directly keeps List in correct state", () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  listInstance.at(0)!.prev = 'test'

  expect(Array.from(listInstance).join('')).toBe('test123456');
});

test("Mutating the last item using ListNode directly keeps List in correct state", () => {
  const listInstance: List<string> = List.from(['1','2','3','4','5','6']);  

  listInstance.at(-1)!.next = 'test'

  expect(Array.from(listInstance).join('')).toBe('123456test');
  expect(listInstance.at(-1)?.value).toBe('test');
  expect(listInstance.at(-2)?.value).toBe('6');
});

test('Mutating item in a middle keeps the list correct', () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  listInstance.at(-4)!.next = 'test'

  expect(Array.from(listInstance).join('')).toBe('123test456');
  expect(listInstance.at(-2)?.value).toBe('5');
  expect(listInstance.at(-4)?.value).toBe('test');
  expect(listInstance.at(-5)?.value).toBe('3');
  expect(listInstance.at(5)?.value).toBe('5');
})

test('First item deletion works correctly', () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  listInstance.at(0)!.delete();

  expect(Array.from(listInstance).join('')).toBe('23456');
  expect(listInstance.at(0)?.value).toBe('2');
  expect(listInstance.at(1)?.value).toBe('3');

})

test('addTo returns node', () => {
  const listInstance = List.from(['1','2','3','4','5','6']);  

  expect(listInstance.addToEnd('test')).toBe(listInstance.at(-1));
  expect(listInstance.addToStart('test2')).toBe(listInstance.at(0));
})