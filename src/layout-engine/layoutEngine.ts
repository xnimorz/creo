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
import type * as CSS from 'csstype';
import { Component, ComponentBuilder, CreoContext, Key } from "../ui/Component";
import { LinkedHashMap, LinkedMap } from "../data-structures/linked-hash-map/LinkedHashMap";
import { onDidUpdate, record, RecordOf } from "../data-structures/record/Record";

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

export function createComponentMeta<P extends object = {}, A extends object = {}>(ctor: ComponentBuilder<P, A>, params: P, maybeKey: Maybe<Key>, layout: LayoutEngine): ComponentMeta {
  const parent = layout.peekMeta();
  const key: Key = maybeKey ?? `creo-${parent.children.size}`;  
  const subscribers: Array<() => void> = []
  const meta: ComponentMeta = {
    key,
    ctor,
    children: LinkedMap(),
    parent,
    mountedParent: null,
    mountedChildren: [],
    beforeItem: null,
    status: ComponentStatus.updating,
    nextChild() {
      return null;
    },
    findByKey(key: Key) {
      return this.children.get(key);
    },
    destroy() {
      for (const subscriber of subscribers) {
        subscriber();
      }
    },
    markDirty() {
      this.status = ComponentStatus.dirty;
      layout.markDirty(this as ComponentMeta);
    },
    ctx: {
      tracked: <T extends {}>(t: T): RecordOf<T> => {
        const rec = record(t);
        subscribers.push(onDidUpdate(rec, () => meta.markDirty()));
        return rec;
      }
    },
    cache: null,
  };
  meta.cache = creoWrapperForComponent(ctor(params, meta.ctx), meta, layout);
  
  return meta;
}

function creoWrapperForComponent<A extends object = {}>(component: Component<A>, meta: ComponentMeta, layout: LayoutEngine): Component<A> {
  return {
    ...component,
    didMount() {
      component.didMount?.();     
    },
    didUpdate() {
      component.didUpdate?.();
    },
    ui() {
      layout.pushMeta(meta);
      component.ui();
      layout.popMeta();
    }
  }
}


enum ComponentStatus {
  dirty,
  parentUpdating,
  updating,
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