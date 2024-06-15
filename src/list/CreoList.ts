/**
 * Linked list impl
 * ideas:
 * [] Shall we use Record for list as well? 
 */

import { Optional } from "../tools/optional";

export class List<T> {
  #next: Optional<List<T>>;
  #prev: Optional<List<T>>;
  public node: T;  

  constructor(node: T, prev: Optional<List<T>> = null, next: Optional<List<T>> = null) {
    this.#prev = prev;
    this.#next = next;
    this.node = node;
  }

  set next(value: T) {
    this.#next = new List(value, this, this.#next);
  }

  set prev(value: T) {
    this.#prev = new List(value, this.#prev, this);
  }

  get value(): T {
    return this.node;
  }

  get next(): Optional<List<T>> {
    return this.#next
  }

  get prev(): Optional<List<T>> {
    return this.#next
  }
}