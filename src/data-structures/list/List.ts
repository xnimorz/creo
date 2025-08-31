/**
 * Linked list impl
 *
 * ideas:
 * [ ] Size support
 */

import { Maybe } from "../maybe/Maybe";
// --- create runtime values that match the types
const $next: unique symbol = Symbol("next");
const $prev: unique symbol = Symbol("prev");
const $list: unique symbol = Symbol("list");

interface IListNode<T> {
  insertNext(value: T): void;
  insertPrev(value: T): void;
  value: T;
  delete(): void;
  getNext(): Maybe<IListNode<T>>;
  getPrev(): Maybe<IListNode<T>>;
  isFirst(): boolean;
  isLast(): boolean;
}
// #region List's Node
export class ListNode<T> implements IListNode<T> {
  [$list]: WeakRef<List<T>>;
  [$next]: Maybe<ListNode<T>>;
  [$prev]: Maybe<ListNode<T>>;
  public value: T;

  constructor(
    node: T,
    prev: Maybe<ListNode<T>> = null,
    next: Maybe<ListNode<T>> = null,
    list: WeakRef<List<T>>,
  ) {
    this[$prev] = prev;
    this[$next] = next;
    this[$list] = list;
    this.value = node;
  }

  isFirst(): boolean {
    return this[$prev] == null;
  }

  isLast(): boolean {
    return this[$next] == null;
  }

  // #region Delete Node from LinkedList
  delete() {
    this[$list].deref()?.delete(this);
    this.clearFields();
  }

  clearFields() {
    this[$next] = null;
    this[$prev] = null;
    // @ts-ignore should be okay, as our goal is to clear the list item and it is not supposed to be used again
    this[$list] = null;
  }

  // #region Getters/setters
  insertNext(value: T) {
    this[$list].deref()?.insertNext(this, value);
  }

  insertPrev(value: T) {
    this[$list].deref()?.insertPrev(this, value);
  }

  getNext(): Maybe<ListNode<T>> {
    return this[$next];
  }

  getPrev(): Maybe<ListNode<T>> {
    return this[$prev];
  }

  // #region Getter of List
  getList() {
    return this[$list].deref();
  }
}

// #region IList public interface
export interface IList<T> extends Iterable<IListNode<T>> {
  insertStart(value: T): ListNode<T>;
  delete(node: IListNode<T>): void;
  at(n: number): Maybe<ListNode<T>>;
  insertEnd(value: T): ListNode<T>;
  insertNext(ref: IListNode<T>, value: T): void;
  insertPrev(ref: IListNode<T>, value: T): void;
  [Symbol.iterator](): IterableIterator<IListNode<T>>;
}

// #region List class
export class List<T> implements IList<T> {
  #head: Maybe<ListNode<T>>;
  #tail: Maybe<ListNode<T>>;
  #selfWeakRef = new WeakRef(this);

  // #region Public methods
  insertStart(value: T) {
    const node = new ListNode(value, null, this.#head, this.#selfWeakRef);
    if (this.#head != null) {
      this.#head[$prev] = node;
    } else {
      this.#tail = node;
    }
    this.#head = node;
    return this.#head;
  }

  delete(node: IListNode<T>): void {
    const n = node as ListNode<T>;
    const prev = n[$prev];
    const next = n[$next];

    if (next) {
      next[$prev] = prev;
    }
    if (prev) {
      prev[$next] = next;
    }
    if (node === this.#head) {
      this.#head = next;
    }
    if (node === this.#tail) {
      this.#tail = prev;
    }
    n.clearFields();
  }

  at(n: number): Maybe<ListNode<T>> {
    let current: Maybe<ListNode<T>>;
    if (n >= 0) {
      current = this.#head;
      for (let i = 0; i < n && current != null; i++) {
        current = current[$next];
      }
    } else {
      current = this.#tail;
      for (let i = n; i < -1 && current != null; i++) {
        current = current[$prev];
      }
    }
    return current;
  }

  insertEnd(value: T): ListNode<T> {
    const node = new ListNode(value, this.#tail, null, this.#selfWeakRef);
    if (this.#tail != null) {
      this.#tail[$next] = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    return this.#tail;
  }

  insertNext(ref: IListNode<T>, value: T): void {
    const r = ref as ListNode<T>;
    if (r[$list].deref() != this) {
      throw new TypeError(
        "The reference node does not belong to the current list",
      );
    }
    const node = new ListNode(value, r, r[$next], this.#selfWeakRef);
    if (r[$next]) {
      r[$next][$prev] = node;
    } else {
      this.#tail = node;
    }
    r[$next] = node;
  }

  insertPrev(ref: IListNode<T>, value: T): void {
    const r = ref as ListNode<T>;
    if (r[$list].deref() != this) {
      throw new TypeError(
        "The reference node does not belong to the current list",
      );
    }
    const node = new ListNode(value, r[$prev], r, this.#selfWeakRef);
    if (r[$prev]) {
      r[$prev][$next] = node;
    } else {
      this.#head = node;
    }
    r[$prev] = node;
  }

  *[Symbol.iterator]() {
    let current = this.#head;
    while (current) {
      yield current;
      current = current[$next];
    }
  }

  static from<T>(arrayLike: Iterable<T>): List<T> {
    const list = new List<T>();
    for (const item of arrayLike) {
      list.insertEnd(item);
    }
    return list;
  }
}
