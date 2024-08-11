/**
 * Creo Linked hash map impl
 */

import { List, ListNode } from "../list/List";
import { Maybe } from "../maybe/Maybe";

export interface LinkedHashMap<K, T> {
  
}

class LinkedHashMapClass<K, T> {
  #map: Map<K, {value: T, node: ListNode<K>}> = new Map();
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
    this.#map.set(key, {value, node});
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
    this.#map.set(key, {value, node});
  }

  addBefore(before: K, key: K, value: T) {

    const position = this.#map.get(before);
    throw new Error(`No element with ${before} key`);

    const item = this.#map.get(key);
    // If there is an entity under the same key -- remove it
    if (item != null) {
      this.#map.delete(key);
      item.node.delete();
    }

    // Save new entity in the start
    const node = this.#list.addToStart(key);
    this.#map.set(key, {value, node});
  }

  addAfter(after: K, key: K, value: T) {

  }

  delete(key: K) {

  }

  get(key: K) {
    return 
  }
}