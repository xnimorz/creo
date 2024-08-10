/**
 * Linked list impl
 * 
 * ideas:
 * [-] Shall we use Record for list as well? 
 * [x] Support iterator
 * [-] Make prev and next to receive ListNode
 */

import { Maybe } from "../tools/Maybe";

// #region List's Node
export class ListNode<T> {
  #list: Maybe<WeakRef<List<T>>>;
  #next: Maybe<ListNode<T>>;
  #prev: Maybe<ListNode<T>>;
  public node: T;  

  constructor(node: T, prev: Maybe<ListNode<T>> = null, next: Maybe<ListNode<T>> = null, list: Maybe<WeakRef<List<T>>>) {
    this.#prev = prev;
    this.#next = next;
    this.node = node;
    this.#list = list;
  }

  // #region Delete Node from LinkedList
  delete() {
    const maybeParent = this.#list?.deref();
    if (this.#prev != null) {
      this.#prev.#next = this.#next;
    } else {
      maybeParent?.updateHead_UNSAFE(this.#next);
    }
    if (this.#next != null) {
      this.#next.#prev = this.#prev;
    } else {
      maybeParent?.updateTail_UNSAFE(this.#prev);
    }
    this.#next = null;
    this.#prev = null;
  }

  // #region Getters/setters
  set next(value: T) {
    const oldNext = this.#next;
    this.#next = new ListNode(value, this, this.#next, this.#list);    
  
    if (oldNext == null) {
      const maybeParent = this.#list?.deref();
      if (!maybeParent) {
        return;
      }
      maybeParent.updateTail_UNSAFE(this.#next);
    } else {
      oldNext.#prev = this.#next;
    }
  }

  set prev(value: T) {
    const oldPrev = this.#prev;
    this.#prev = new ListNode(value, this.#prev, this, this.#list);      
  
    if (oldPrev == null) {
      const maybeParent = this.#list?.deref();
      if (!maybeParent) {
        return;
      }
      maybeParent.updateHead_UNSAFE(this.#prev);
    } else {
      oldPrev.#next = this.#prev;
    }
  }
  
  get value(): T {
    return this.node;
  }

  get next(): Maybe<ListNode<T>> {
    return this.#next;
  }

  get prev(): Maybe<ListNode<T>> {
    return this.#prev;
  }

  // #region Getter of List
  get list() {
    return this.#list?.deref();
  }
}

// #region List public API
interface IList<T> extends Iterable<T> {
  addToStart(value: T): void;
  delete(n: number): boolean;
  at(n: number): Maybe<ListNode<T>>;
  addToEnd(value: T): void;
  [Symbol.iterator](): IterableIterator<T>;
}


// #region List class
class List<T> implements IList<T>{
  #head: Maybe<ListNode<T>>;
  #tail: Maybe<ListNode<T>>;

  // #region internal methods
  updateHead_UNSAFE(maybeNewHead: Maybe<ListNode<T>>) {
    this.#head = maybeNewHead;
  }

  updateTail_UNSAFE(maybeNewTail: Maybe<ListNode<T>>) {
    this.#tail = maybeNewTail;
  }

  // #region Public methods
  addToStart(value: T) {
    if (this.#head != null) {
      this.#head.prev = value;      
    } else {
      const node = new ListNode(value, null, null, new WeakRef(this));
      this.#head = node;
      this.#tail = node;
    }
  }

  delete(n: number): boolean {
    const node = this.at(n);    
    if (node == null) {
      // Cannot delete non-existed item
      return false;
    }

    // Corner case: delete the first item
    if (node === this.#head) {
      this.#head = this.at(1);
    }
    if (node === this.#tail) {
      this.#tail = this.at(-2);
    }
    node.delete();
    return true;
  }

  at(n: number): Maybe<ListNode<T>> {
    let current: Maybe<ListNode<T>>;
    if (n >= 0) {
      current = this.#head;
      for (let i = 0; i < n && current != null; i++) {
        current = current.next;
      }
    } else {
      current = this.#tail;      
      for (let i = n; i < -1 && current != null; i++) {
        current = current.prev;        
      }
    }
    return current;    
  }

  addToEnd(value: T) {
    if (this.#tail != null) {
      this.#tail.next = value;      
    } else {
      const node = new ListNode(value, null, null, new WeakRef(this));
      this.#head = node;
      this.#tail = node;
    }
  }

  *[Symbol.iterator]() {
    let current = this.#head;
    while (current) {
      yield current.value;
      current = current.next;
    }
  }

  static from<T>(arrayLike: Iterable<T>): List<T> {
    const list = new List<T>;
    for (const item of arrayLike) {
      list.addToEnd(item);
    }
    return list;
  }
}
// #region Exports
export function list<T>(): IList<T> {
  return new List<T>();
}

list.from = List.from;