/**
 * Linked list impl
 * ideas:
 * [-] Shall we use Record for list as well? 
 * [x] Support iterator
 * [] Make prev and next to receive ListNode
 */

import { Optional } from "../tools/optional";


export class ListNode<T> {
  #list: Optional<WeakRef<List<T>>>;
  #next: Optional<ListNode<T>>;
  #prev: Optional<ListNode<T>>;
  public node: T;  

  constructor(node: T, prev: Optional<ListNode<T>> = null, next: Optional<ListNode<T>> = null, list: Optional<WeakRef<List<T>>>) {
    this.#prev = prev;
    this.#next = next;
    this.node = node;
    this.#list = list;
  }

  get list() {
    return this.#list?.deref();
  }
  
  set next(value: T) {
    const oldNext = this.#next;
    this.#next = new ListNode(value, this, this.#next, this.#list);    
  
    if (oldNext == null) {
      const maybeParent = this.#list?.deref();
      if (!maybeParent) {
        return;
      }
      maybeParent.nextChanged();
    } else {
      oldNext.#prev = this.#next;
    }
  }

  delete() {
    if (this.#prev != null) {
      this.#prev.#next = this.#next;
    }
    if (this.#next != null) {
      this.#next.#prev = this.#prev;
    }
    this.#next = null;
    this.#prev = null;
  }

  set prev(value: T) {
    const oldPrev = this.#prev;
    this.#prev = new ListNode(value, this.#prev, this, this.#list);      
  
    if (oldPrev == null) {
      const maybeParent = this.#list?.deref();
      if (!maybeParent) {
        return;
      }
      maybeParent.prevChanged();
    } else {
      oldPrev.#next = this.#prev;
    }
  }

  insertPrev(value: T) {

  }

  insertNext(value: T) {

  }

  get value(): T {
    return this.node;
  }

  get next(): Optional<ListNode<T>> {
    return this.#next;
  }

  get prev(): Optional<ListNode<T>> {
    return this.#prev;
  }
}

export class List<T> {
  #head: Optional<ListNode<T>>;
  #tail: Optional<ListNode<T>>;

  prevChanged() {
    while (this.#head?.prev != null)  {
      this.#head = this.#head.prev;
    }
  }

  nextChanged() {
    while (this.#tail?.next != null)  {
      this.#tail = this.#tail.next;
    }
  }

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

  at(n: number): Optional<ListNode<T>> {
    let current: Optional<ListNode<T>>;
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