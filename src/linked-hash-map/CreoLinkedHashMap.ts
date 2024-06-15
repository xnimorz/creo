/**
 * Creo Linked hash map impl
 */

import { List } from "../list/CreoList";

export class CreoList<K, T> {
  #map: Map<K, {value: T, list: List<K>}> = new Map();
  #list: List<K> = new List();  

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