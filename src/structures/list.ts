import { just } from "@/functional/maybe";

export class List<Node> {
  map: Map<Node, number> = new Map();
  constructor(protected items: Node[]) {
    items.forEach((item, index) => {
      this.map.set(item, index);
    });
  }

  /**
   * Appends new elements to the end of a list
   * @param items — New elements to add to the list.
   */
  push(...items: Node[]) {
    for (const item of items) {
      this.map.set(item, this.items.length);
      this.items.push(item);
    }
  }

  /**
   * Inserts new elements at the start of a list
   * @param items — Elements to insert at the start of the list.
   */
  unshift(...items: Node[]) {
    for (const item of items) {
      this.map.set(item, 0);
      this.items.unshift(item);
    }
  }

  get length() {
    return this.items.length;
  }

  /**
   * Returns a copy of a section of an array. For both start and end,
   *    a negative index can be used to indicate an offset from the end of the array.
   * For example, -2 refers to the second to last element of the array.
   *
   * @param start
   * The beginning index of the specified portion of the array. If start is undefined, then the slice begins at index 0.
   *
   * @param end
   * The end index of the specified portion of the array. This is exclusive of the element at the index 'end'. If end is undefined, then the slice extends to the end of the array.
   */
  slice(start?: number, end?: number): List<Node> {
    return new List(this.items.slice(start, end));
  }

  delete(item: Node) {
    const index = this.map.get(item);
    if (index === undefined) {
      return;
    }
    this.#delete(index, item);
  }

  indexOf(item: Node) {
    return this.map.get(item);
  }

  has(item: Node) {
    return this.map.has(item);
  }

  #delete(index: number, item: Node) {
    this.map.delete(item);
    this.items.splice(index, 1);
    // Update the map for items after the deleted item
    let $;
    for (let i = index; i < this.items.length; i++) {
      $ = this.items[i];
      just($);
      this.map.set($, i);
    }
  }

  deleteAt(index: number) {
    const item = this.items[index];
    if (item === undefined) {
      return;
    }
    this.#delete(index, item);
  }

  at(index: number) {
    return this.items.at(index);
  }

  *[Symbol.iterator]() {
    for (const item of this.items) {
      yield item;
    }
  }
}
