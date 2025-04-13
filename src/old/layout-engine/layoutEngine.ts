/**
 * Layout engine abstract class
 *
 *
 * Ideas:
 * [ ] HTML layout engine, that re-uses existing HTML&CSS
 * [ ] Canvas layout engine
 * [ ] String layout engine
 * [ ] Event systems
 * [ ] Animation engine
 * [ ] Layout engines should work with CreoTree
 */

import { isJust, Maybe } from "../data-structures/maybe/Maybe";
import type * as CSS from "csstype";
import {
  Component,
  ComponentBuilder,
  ComponentMeta,
  CreoContext,
  Key,
} from "../ui/Component";
import {
  LinkedHashMap,
  LinkedMap,
} from "../data-structures/linked-hash-map/LinkedHashMap";
import {
  onDidUpdate,
  record,
  RecordOf,
} from "../data-structures/record/Record";

export const BasePrimitives = new Set([
  "block",
  "vstack",
  "grid",
  "input",
  "hstack",
  "list",
  "text",
  "checkbox",
  "button",
]);

export abstract class LayoutEngine {
  /**
   *
   * ????
   * @param ui
   */
  abstract create(ui: () => void): void;
  /**
   * Marks the whole tree as dirty and re-renders it
   */
  abstract refresh(): void;
  // Cursor operations:
  /**
   * Puts ComponentMeta to stack
   *
   * @param meta Meta of the component where the cursor should be placed
   */
  abstract pushMeta(meta: ComponentMeta): void;
  /**
   *
   * Creates new component & new ComponentMeta context for it
   *
   */
  abstract createNewComponent(
    ctor: ComponentBuilder<any, any>,
    key: Maybe<Key>,
  ): ComponentMeta;
  /**
   *
   * Peeks the top componentMeta from stack
   *
   */
  abstract peekMeta(): ComponentMeta;
  /**
   *
   * Removes top component from the stack
   *
   */
  abstract popMeta(): ComponentMeta;

  abstract lowLevel(
    type: string,
    props: {
      css?: CSS.Properties;
      attr: object;
    },
  ): void;
  /**
   *
   * Marks the provided component as dirty, to schedule the update
   *
   * @param meta
   */
  abstract markDirty(meta: ComponentMeta): void;
}

let c_currentEngine: Maybe<LayoutEngine>;

export function c_setLayoutEngine(layoutEngine: LayoutEngine) {
  c_currentEngine = layoutEngine;
}

export function c_resetLayoutEngine() {
  c_currentEngine = null;
}

export function getLayoutEngine(): Maybe<LayoutEngine> {
  return c_currentEngine;
}
