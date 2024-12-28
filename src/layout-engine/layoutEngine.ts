/**
 * Layout engine abstract class
 *
 *
 * Ideas:
 * [ ] HTML layout engine, that re-uses existing HTML&CSS
 * [ ] Canvas layout engine
 * [ ] Event systems
 * [ ] Animation engine
 * [ ] Layout engines should work with CreoTree
 */

import { Maybe } from "../data-structures/maybe/Maybe";
import { Component } from "../ui/Component";
import { Root } from "../ui/env/Root";

export abstract class LayoutEngine {
  private _root: Root;
  private creoTree: CreoTree;
  // private renderingTree;
  // abstract registryRoot(root: Root) {
  //     this._root = root;
  // }
  // abstract registryComponent(
  // )
}

let c_currentEngine: Maybe<LayoutEngine>;

export function setLayoutEngine(layoutEngine: LayoutEngine) {
  c_currentEngine = layoutEngine;
}

export function resetLayoutEngine() {
  c_currentEngine = null;
}

export function getLayoutEngine(): Maybe<LayoutEngine> {
  return c_currentEngine;
}