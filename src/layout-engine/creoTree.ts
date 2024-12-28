/**
 * HTML layout for creo
 *
 *
 * Ideas:
 * [ ] Re-uses existing HTML&CSS
 */

import { LinkedHashMap, LinkedMap } from "../data-structures/linked-hash-map/LinkedHashMap";
import { LayoutEngine } from "./layoutEngine";
import { Component } from '../ui/Component';

export class CreoTree<T: Component> {
  public map: LinkedHashMap<string, T> = LinkedMap();
}
