/**
 * IndexedList — linked list with O(1) identity-based lookup.
 *
 * Combines a doubly-linked list (O(1) insert/delete given a node)
 * with a Map<T, INode<T>> for O(1) lookup by value identity.
 *
 * All mutating operations are O(1):
 *   push, delete, has, first, last, clear
 */

import { InternalList, type INode } from "./list";
import type { Maybe } from "@/functional/maybe";

export class IndexedList<T> {
  #list = new InternalList<T>();
  #map = new Map<T, INode<T>>();

  /** Append item to the end. No-op if already present. Returns the node. */
  push(item: T): INode<T> {
    const existing = this.#map.get(item);
    if (existing) return existing;
    const node = this.#list.insertEnd(item);
    this.#map.set(item, node);
    return node;
  }

  /** Insert item at the front. No-op if already present. */
  unshift(item: T): void {
    if (this.#map.has(item)) return;
    const node = this.#list.insertStart(item);
    this.#map.set(item, node);
  }

  /** Insert item after ref. No-op if item already present. */
  insertAfter(ref: T, item: T): void {
    if (this.#map.has(item)) return;
    const refNode = this.#map.get(ref);
    if (!refNode) { this.push(item); return; }
    const node = refNode.insertNext(item);
    this.#map.set(item, node);
  }

  /** Remove item. O(1). */
  delete(item: T): void {
    const node = this.#map.get(item);
    if (!node) return;
    this.#map.delete(item);
    node.delete();
  }

  /** Check membership. O(1). */
  has(item: T): boolean {
    return this.#map.has(item);
  }

  /** Number of items. */
  get length(): number {
    return this.#map.size;
  }

  /** Get the first item (head). O(1). */
  first(): Maybe<T> {
    return this.#list.first()?.v;
  }

  /** Get the last item (tail). O(1). */
  last(): Maybe<T> {
    return this.#list.last()?.v;
  }

  /** Get the linked-list node for an item. O(1). */
  getNode(item: T): Maybe<INode<T>> {
    return this.#map.get(item);
  }

  /** Positional access. O(n) — prefer getNode + getNext for traversal. */
  at(index: number): Maybe<T> {
    return this.#list.at(index)?.v;
  }

  /** Reset to empty. O(1). */
  clear(): void {
    this.#list.clear();
    this.#map.clear();
  }

  /** Iterate values in insertion order. */
  *[Symbol.iterator](): IterableIterator<T> {
    for (const node of this.#list) {
      yield node.v;
    }
  }
}
