/**
 * Creo Linked hash map impl
 */

import { List } from "../list/List";
import { Optional } from "../tools/optional";

export class LinkedHashMap<K, T> {
  #map: Map<K, {value: T, list: List<K>}> = new Map();
  #list: Optional<List<K>>;

  addToEnd(key: K, value: T) {
    this.#list
  }

  addToStart(key: K, value: T) {

  }

  addBefore(before: K, key: K, value: T) {

  }

  addAfter(after: K, key: K, value: T) {

  }

  delete(key: K) {

  }

  get(key: K) {
    return 
  }
}