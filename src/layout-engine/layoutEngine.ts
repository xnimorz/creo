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

import { Maybe } from "../data-structures/maybe/Maybe";
import type * as CSS from 'csstype';
import { Component, ComponentBuilder, CreoContext, Key } from "../ui/Component";
import { LinkedHashMap } from "../data-structures/linked-hash-map/LinkedHashMap";

export type ComponentMeta = {
  key: Key
  ctor: ComponentBuilder<any, any>
  cache: Component<any>
  ctx: CreoContext,
  children: LinkedHashMap<Key, ComponentMeta>
  parent: ComponentMeta
  mountedParent: any // currently any, but should be an item, to which data can be mounted in reality
  mountedChildren: Array<any> /// list of items which rendered that component in real UI
  beforeItem: any // real rendered item before which this component places its own data
  status: ComponentStatus  
  nextChild: () => Maybe<ComponentMeta>
  findByKey: (key: Key) => Maybe<ComponentMeta>
  markDirty: () => void
  destroy: () => void
}

export function createComponentMeta<P extends object = {}, A extends object = {}>(ctor: ComponentBuilder<P, A>, params: P, key: Key, layout: LayoutEngine): ComponentMeta {
  const instance = ctor(params, componentMeta.ctx);
  componentMeta.cache = creoWrapperForComponent(instance, componentMeta, layout);
  return {
    
  }
}

enum ComponentStatus {
  dirty,
  parentUpdating,
  clear
}

export const BasePrimitives = new Set(['block', 'vstack', 'grid', 'input', 'hstack', 'list', 'text', 'checkbox', 'button']);

export abstract class LayoutEngine {
  abstract create(ui: () => void): void;
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
   * Cretes new component & new ComponentMeta context for it
   * 
   */
  abstract createNewComponent(ctor: ComponentBuilder<any, any>, key: Maybe<Key>): ComponentMeta;
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

  abstract lowLevel(type: string, props: {
    css?: CSS.Properties,
    attr: object
  }): void;  
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