import { Maybe } from "../maybe/Maybe";

type LinkNode<T, K> = {
  value: T;
  prev: Maybe<LinkNode<T, K>>;
  next: Maybe<LinkNode<T, K>>;
};

export class IndexedMap<T extends object, K extends keyof T>
  implements Iterable<T>
{
  private head: Maybe<LinkNode<T, K>>;
  private tail: Maybe<LinkNode<T, K>>;
  private mapSize = 0;
  private pk: K;
  private map = new Map<T[K], LinkNode<T, K>>();
  private indexes: Map<keyof T, Map<T[keyof T], Set<LinkNode<T, K>>>> =
    new Map();

  constructor(pk: K, indexFields: Array<keyof T> = []) {
    this.pk = pk;
    for (const field of indexFields) {
      if (field === pk) continue;
      this.indexes.set(field, new Map());
    }
  }

  // Puts item to the end
  // Removes previous item, if PK is matched
  put(item: T): void {
    const key = item[this.pk];
    // Delete previous, if any
    this.delete(key);

    const node: LinkNode<T, K> = { value: item, prev: this.tail, next: null };
    if (!this.head) {
      this.head = node;
    }
    if (this.tail) {
      this.tail.next = node;
    }
    this.tail = node;
    this.map.set(key, node);
    this.mapSize++;

    // update secondary indexes
    this.indexNewNode(node);
  }

  putBefore(targetKey: T[K], item: T): void {
    const target = this.map.get(targetKey);
    if (target == null) {
      throw new Error(`Key not found: ${String(targetKey)}`);
    }
    const key = item[this.pk];
    if (targetKey === key) {
      return;
    }
    this.delete(key);

    const node: LinkNode<T, K> = {
      value: item,
      prev: target.prev,
      next: target,
    };
    if (target.prev) {
      target.prev.next = node;
    } else {
      this.head = node;
    }
    target.prev = node;

    this.map.set(key, node);
    this.mapSize++;
    this.indexNewNode(node);
  }

  updateIndex<K extends keyof T>(item: T, index: K, prevValue: T[K]) {
    const node = this.map.get(item[this.pk]);
    if (node == null) {
      return;
    }
    this.indexes.get(index)?.get(prevValue)?.delete(node);
    this.indexes.get(index)?.get(item[index])?.add(node);
  }

  private indexNewNode(node: LinkNode<T, K>) {
    for (const [field, map] of this.indexes) {
      const val = node.value[field];
      let set = map.get(val);
      if (!set) {
        set = new Set();
        map.set(val, set);
      }
      set.add(node);
    }
  }

  putAfter(targetKey: T[K], item: T): void {
    const target = this.map.get(targetKey);
    if (target == null) {
      throw new Error(`Key not found: ${String(targetKey)}`);
    }
    const key = item[this.pk];
    if (targetKey === key) {
      return;
    }

    const node: LinkNode<T, K> = {
      value: item,
      prev: target,
      next: target.next,
    };
    if (target.next) {
      target.next.prev = node;
    } else {
      this.tail = node;
    }
    target.next = node;

    this.map.set(key, node);
    this.mapSize++;
    this.indexNewNode(node);
  }

  delete(key: T[K]): boolean {
    const node = this.map.get(key);
    if (node == null) {
      return false;
    }

    // unlink from list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // remove from indexes
    this.map.delete(key);
    for (const [field, map] of this.indexes) {
      const indexValue = node.value[field];
      const set = map.get(indexValue);
      if (set != null) {
        set.delete(node);
      }
    }

    this.mapSize--;
    return true;
  }

  get(key: T[K]): Maybe<T> {
    return this.map.get(key)?.value;
  }

  getByIndex<K extends keyof T>(field: K, val: T[keyof T]): Array<T> {
    const map = this.indexes.get(field);
    if (!map) {
      throw new Error(`No index defined for field "${String(field)}"`);
    }
    const set = map.get(val);
    return set ? Array.from(set.values(), (node) => node.value) : [];
  }

  // Get next item in insertion order
  getNext(key: T[K]): T | undefined {
    return this.map.get(key)?.next?.value;
  }

  // Get previous item in insertion order
  getPrev(key: T[K]): Maybe<T> {
    return this.map.get(key)?.prev?.value;
  }

  size(): number {
    return this.mapSize;
  }

  [Symbol.iterator](): Iterator<T> {
    let curr = this.head;
    return {
      next(): IteratorResult<T> {
        if (!curr) {
          return { done: true, value: undefined! };
        }
        const value = curr.value;
        curr = curr.next;
        return { done: false, value };
      },
    };
  }
}
