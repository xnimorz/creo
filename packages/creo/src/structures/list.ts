/**
 * Linked list implementation
 */

import type { Maybe } from "@/functional/maybe";

const $next: unique symbol = Symbol("next");
const $prev: unique symbol = Symbol("prev");
const $owner: unique symbol = Symbol("owner");

export interface INode<T> {
  insertNext(value: T): INode<T>;
  insertPrev(value: T): INode<T>;
  v: T;
  delete(): void;
  getNext(): Maybe<INode<T>>;
  getPrev(): Maybe<INode<T>>;
  isFirst(): boolean;
  isLast(): boolean;
}

export class ListNode<T> implements INode<T> {
  [$owner]: Maybe<IBaseContainer<T>>;
  [$next]: Maybe<ListNode<T>>;
  [$prev]: Maybe<ListNode<T>>;
  public v: T;

  constructor(
    node: T,
    prev: Maybe<ListNode<T>> = null,
    next: Maybe<ListNode<T>> = null,
    list: IBaseContainer<T>,
  ) {
    this[$prev] = prev;
    this[$next] = next;
    this[$owner] = list;
    this.v = node;
  }

  isFirst(): boolean {
    return this[$prev] == null;
  }

  isLast(): boolean {
    return this[$next] == null;
  }

  delete() {
    this[$owner]?.delete(this);
  }

  clearFields() {
    this[$next] = null;
    this[$prev] = null;
    this[$owner] = null;
  }

  insertNext(value: T) {
    const owner = this[$owner];
    if (!owner) {
      throw new Error("The item is detached from DataContainer");
    }
    return owner.insertNext(this, value);
  }

  insertPrev(value: T) {
    const owner = this[$owner];
    if (!owner) {
      throw new Error("The item is detached from DataContainer");
    }
    return owner.insertPrev(this, value);
  }

  getNext(): Maybe<ListNode<T>> {
    return this[$next];
  }

  getPrev(): Maybe<ListNode<T>> {
    return this[$prev];
  }

  getList() {
    return this[$owner];
  }
}

interface IBaseContainer<T> {
  delete(node: INode<T>): void;
  insertNext(ref: INode<T>, value: T): INode<T>;
  insertPrev(ref: INode<T>, value: T): INode<T>;
}

export interface IList<T> extends Iterable<INode<T>>, IBaseContainer<T> {
  insertStart(value: T): INode<T>;
  insertEnd(value: T): INode<T>;
  at(n: number): Maybe<INode<T>>;
  first(): Maybe<INode<T>>;
  last(): Maybe<INode<T>>;
  readonly size: number;
  [Symbol.iterator](): IterableIterator<INode<T>>;
}

export class InternalList<T> implements IList<T> {
  #head: Maybe<ListNode<T>>;
  #tail: Maybe<ListNode<T>>;
  #size = 0;

  // Cursor cache: remembers last .at() result so sequential access is O(1)
  #cursorNode: Maybe<ListNode<T>>;
  #cursorIndex = -1;

  #invalidateCursor() {
    this.#cursorNode = null;
    this.#cursorIndex = -1;
  }

  insertStart(value: T) {
    const node = new ListNode(value, null, this.#head, this);
    if (this.#head != null) {
      this.#head[$prev] = node;
    } else {
      this.#tail = node;
    }
    this.#head = node;
    this.#size++;
    this.#invalidateCursor();
    return this.#head;
  }

  delete(node: INode<T>): void {
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
    this.#size--;
    this.#invalidateCursor();
  }

  at(n: number): Maybe<ListNode<T>> {
    // Normalise negative index
    if (n < 0) n = this.#size + n;
    if (n < 0 || n >= this.#size) return;

    // Pick the closest starting point among head, tail, and cached cursor
    let current: Maybe<ListNode<T>>;
    let pos: number;

    const distFromHead = n;
    const distFromTail = this.#size - 1 - n;
    const distFromCursor =
      this.#cursorNode != null ? Math.abs(n - this.#cursorIndex) : Infinity;

    if (distFromCursor <= distFromHead && distFromCursor <= distFromTail) {
      // Start from cursor
      current = this.#cursorNode;
      pos = this.#cursorIndex;
    } else if (distFromHead <= distFromTail) {
      // Start from head
      current = this.#head;
      pos = 0;
    } else {
      // Start from tail
      current = this.#tail;
      pos = this.#size - 1;
    }

    // Walk to target
    while (pos < n && current != null) {
      current = current[$next];
      pos++;
    }
    while (pos > n && current != null) {
      current = current[$prev];
      pos--;
    }

    // Update cursor cache
    if (current != null) {
      this.#cursorNode = current;
      this.#cursorIndex = pos;
    }

    return current;
  }

  get size(): number {
    return this.#size;
  }

  /** Reset the list to empty. O(1). */
  clear(): void {
    this.#head = null;
    this.#tail = null;
    this.#size = 0;
    this.#invalidateCursor();
  }

  /** O(1) head access. */
  first(): Maybe<ListNode<T>> {
    return this.#head;
  }

  /** O(1) tail access. */
  last(): Maybe<ListNode<T>> {
    return this.#tail;
  }

  insertEnd(value: T): ListNode<T> {
    const node = new ListNode(value, this.#tail, null, this);
    if (this.#tail != null) {
      this.#tail[$next] = node;
    } else {
      this.#head = node;
    }
    this.#tail = node;
    this.#size++;
    // Don't invalidate cursor — appending doesn't shift existing indices
    return this.#tail;
  }

  insertNext(ref: INode<T>, value: T): ListNode<T> {
    const r = ref as ListNode<T>;
    if (r[$owner] != this) {
      throw new TypeError(
        "The reference node does not belong to the current list",
      );
    }
    const node = new ListNode(value, r, r[$next], this);
    if (r[$next]) {
      r[$next][$prev] = node;
    } else {
      this.#tail = node;
    }
    r[$next] = node;
    this.#size++;
    this.#invalidateCursor();
    return node;
  }

  insertPrev(ref: INode<T>, value: T): ListNode<T> {
    const r = ref as ListNode<T>;
    if (r[$owner] != this) {
      throw new TypeError(
        "The reference node does not belong to the current list",
      );
    }
    const node = new ListNode(value, r[$prev], r, this);
    if (r[$prev]) {
      r[$prev][$next] = node;
    } else {
      this.#head = node;
    }
    r[$prev] = node;
    this.#size++;
    this.#invalidateCursor();
    return node;
  }

  *[Symbol.iterator]() {
    let current = this.#head;
    while (current) {
      const next = current[$next]; // save before yield — node may be deleted during iteration
      yield current;
      current = next;
    }
  }
}

export class List<T> extends InternalList<T> implements IList<T> {
  static from<T>(arrayLike: Iterable<T>): List<T> {
    const list = new List<T>();
    for (const item of arrayLike) {
      list.insertEnd(item);
    }
    return list;
  }
}
