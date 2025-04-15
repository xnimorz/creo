/**
 * Creo Linked hash map impl
 *
 * [ ] Need null & undefined proper support for LinkedHashMap values
 * [ ] LinkedHashMap Node? so that you can iterate next/prev ??
 */

import { List, ListNode } from "../list/List";
import { Maybe } from "../maybe/Maybe";

export interface LinkedHashMap<K, T> extends Iterable<[K, T]> {
  addToEnd(key: K, value: T): void;
  addToStart(key: K, value: T): void;
  addBefore(before: K, key: K, value: T): void;
  addAfter(after: K, key: K, value: T): void;
  delete(key: K): void;
  get(key: K): Maybe<T>;
  getNextKey(key: K): Maybe<K>;
  at(n: number): Maybe<T>;
  size(): number;
  [Symbol.iterator](): IterableIterator<[K, T]>;
}

class LinkedHashMapClass<K, T> implements LinkedHashMap<K, T> {
  #map: Map<K, { value: T; node: ListNode<K> }> = new Map();
  #list: List<K> = List();

  addToEnd(key: K, value: T) {
    const item = this.#map.get(key);
    // If there is an entity under the same key -- remove it
    if (item != null) {
      this.#map.delete(key);
      item.node.delete();
    }

    // Save new entity in the end
    const node = this.#list.addToEnd(key);
    this.#map.set(key, { value, node });
  }

  addToStart(key: K, value: T) {
    const item = this.#map.get(key);
    // If there is an entity under the same key -- remove it
    if (item != null) {
      this.#map.delete(key);
      item.node.delete();
    }

    // Save new entity in the start
    const node = this.#list.addToStart(key);
    this.#map.set(key, { value, node });
  }

  addBefore(before: K, key: K, value: T) {
    const position = this.#map.get(before);
    if (!position) {
      throw new Error(`No element with ${before} key`);
    }

    const item = this.#map.get(key);
    // If there is an entity under the same key -- remove it
    if (item != null) {
      this.#map.delete(key);
      item.node.delete();
    }

    // Save a new entity
    position.node.prev = key;
    const node = position.node.prev;
    if (!node) {
      throw new Error("Safeguard. Node was not inserted properly");
    }
    this.#map.set(key, { value, node });
  }

  addAfter(after: K, key: K, value: T) {
    const position = this.#map.get(after);
    if (!position) {
      throw new Error(`No element with ${after} key`);
    }

    const item = this.#map.get(key);
    // If there is an entity under the same key -- remove it
    if (item != null) {
      this.#map.delete(key);
      item.node.delete();
    }

    // Save a new entity
    position.node.next = key;
    const node = position.node.next;
    if (!node) {
      throw new Error("Safeguard. Node was not inserted properly");
    }
    this.#map.set(key, { value, node });
  }

  delete(key: K) {
    const item = this.#map.get(key);
    this.#map.delete(key);
    item?.node.delete();
  }

  getNextKey(key: K): Maybe<K> {
    return this.#map.get(key)?.node.next?.value;
  }

  get(key: K): Maybe<T> {
    return this.#map.get(key)?.value;
  }

  at(n: number): Maybe<T> {
    const item = this.#list.at(n);
    if (item == null) {
      return;
    }
    return this.#map.get(item.value)?.value;
  }

  size(): number {
    return this.#map.size;
  }

  *[Symbol.iterator](): Generator<[K, T], void, unknown> {
    for (let key of this.#list) {
      const node = this.#map.get(key);
      if (node == null) {
        continue;
      }
      yield [key, node.value];
    }
  }
}

export function LinkedMap<K, T>(): LinkedHashMap<K, T> {
  // @ts-ignore
  return new LinkedHashMapClass();
}
