/**
 * Linked list impl
 *
 * ideas:
 * [ ] Size support
 */

import { Maybe } from "../maybe/Maybe";

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
// #region List's Node
export class ListNode<T> implements INode<T> {
  [$owner]: Maybe<WeakRef<IBaseContainer<T>>>;
  [$next]: Maybe<ListNode<T>>;
  [$prev]: Maybe<ListNode<T>>;
  public v: T;

  constructor(
    node: T,
    prev: Maybe<ListNode<T>> = null,
    next: Maybe<ListNode<T>> = null,
    list: WeakRef<IBaseContainer<T>>,
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

  // #region Delete Node from LinkedList
  delete() {
    this[$owner]?.deref()?.delete(this);
    this.clearFields();
  }

  clearFields() {
    this[$next] = null;
    this[$prev] = null;
    this[$owner] = null;
  }

  // #region Getters/setters
  insertNext(value: T) {
    const owner = this[$owner]?.deref();
    if (!owner) {
      throw new Error("The item is detached from DataContainer");
    }
    return owner.insertNext(this, value);
  }

  insertPrev(value: T) {
    const owner = this[$owner]?.deref();
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

  // #region Getter of List
  getList() {
    return this[$owner]?.deref();
  }
}

export interface IBaseContainer<T> {
  delete(node: INode<T>): void;
  insertNext(ref: INode<T>, value: T): INode<T>;
  insertPrev(ref: INode<T>, value: T): INode<T>;
}

// #region IList public interface
export interface IList<T> extends Iterable<INode<T>>, IBaseContainer<T> {
  insertStart(value: T): INode<T>;
  at(n: number): Maybe<INode<T>>;
  insertEnd(value: T): INode<T>;
  [Symbol.iterator](): IterableIterator<INode<T>>;
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

  insertNext(ref: INode<T>, value: T): ListNode<T> {
    const r = ref as ListNode<T>;
    if (r[$owner]?.deref() != this) {
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
    return node;
  }

  insertPrev(ref: INode<T>, value: T): ListNode<T> {
    const r = ref as ListNode<T>;
    if (r[$owner]?.deref() != this) {
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
    return node;
  }

  *[Symbol.iterator]() {
    let current = this.#head;
    while (current) {
      yield current;
      current = current[$next];
    }
  }
}

export function initListFromArray<T>(arrayLike: Iterable<T>): List<T> {
  const list = new List<T>();
  for (const item of arrayLike) {
    list.insertEnd(item);
  }
  return list;
}

export interface ILinkedMap<T extends object, K extends keyof T>
  extends IList<T> {
  upsertStart(value: T): INode<T>;
  upsertEnd(value: T): INode<T>;
  upsertNext(ref: INode<T>, value: T): void;
  upsertPrev(ref: INode<T>, value: T): void;
  get(key: T[K]): Maybe<INode<T>>;
  size(): number;
}

export class LinkedMap<T extends object, K extends keyof T>
  extends List<T>
  implements ILinkedMap<T, K>
{
  #pk: K;
  #map: Map<T[K], ListNode<T>> = new Map();

  constructor(pk: K) {
    super();
    this.#pk = pk;
  }

  // #region Public methods
  insertStart(value: T) {
    const key = value[this.#pk];
    if (this.#map.has(key)) {
      throw new Error(`Cannot insert item, ${key} already exists`);
    }
    const node = super.insertStart(value);
    this.#map.set(key, node);
    return node;
  }

  upsertStart(value: T): INode<T> {
    const key = value[this.#pk];
    const node = super.insertStart(value);
    this.#map.set(key, node);
    return node;
  }

  delete(node: INode<T>): void {
    const key = node.v[this.#pk];
    this.#map.delete(key);
    super.delete(node);
  }

  insertEnd(value: T): ListNode<T> {
    const key = value[this.#pk];
    if (this.#map.has(key)) {
      throw new Error(`Cannot insert item, ${key} already exists`);
    }
    const node = super.insertEnd(value);
    this.#map.set(key, node);
    return node;
  }

  upsertEnd(value: T): ListNode<T> {
    const key = value[this.#pk];
    const node = super.insertEnd(value);
    this.#map.set(key, node);
    return node;
  }

  insertNext(ref: INode<T>, value: T): ListNode<T> {
    const key = value[this.#pk];
    if (this.#map.has(key)) {
      throw new Error(`Cannot insert item, ${key} already exists`);
    }
    const node = super.insertNext(ref, value);
    this.#map.set(key, node);
    return node;
  }

  upsertNext(ref: INode<T>, value: T): ListNode<T> {
    const key = value[this.#pk];
    const node = super.insertNext(ref, value);
    this.#map.set(key, node);
    return node;
  }

  insertPrev(ref: INode<T>, value: T): ListNode<T> {
    const key = value[this.#pk];
    if (this.#map.has(key)) {
      throw new Error(`Cannot insert item, ${key} already exists`);
    }
    const node = super.insertPrev(ref, value);
    this.#map.set(key, node);
    return node;
  }

  upsertPrev(ref: INode<T>, value: T): ListNode<T> {
    const key = value[this.#pk];
    const node = super.insertPrev(ref, value);
    this.#map.set(key, node);
    return node;
  }
  get(key: T[K]): Maybe<INode<T>> {
    return this.#map.get(key);
  }

  size(): number {
    return this.#map.size;
  }
}

export function initLinkedMapFromArray<T extends object, K extends keyof T>(
  arrayLike: Iterable<T>,
  key: K,
): LinkedMap<T, K> {
  const lm = new LinkedMap<T, K>(key);
  for (const item of arrayLike) {
    lm.insertEnd(item);
  }
  return lm;
}
