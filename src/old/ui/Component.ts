/**
 * Component wrapper for UI layer
 *
 *
 * Ideas:
 * [ ] Proxy checks if the usage is allowed
 * [ ] Constructor checks if we are inside rendering cycle
 * [ ] Keep track on rendering tree and keep stuctured ordering
 * [ ] Treat ID param as special one
 * [ ] Use memory
 */

import {
  LinkedHashMap,
  LinkedMap,
} from "../../data-structures/linked-hash-map/LinkedHashMap";
import {
  isRecord,
  onDidUpdate,
  record,
  RecordOf,
} from "../../data-structures/record/Record";
import type * as CSS from "csstype";
import { getLayoutEngine, LayoutEngine } from "../layout-engine/layoutEngine";
import { isJust, isNone, Maybe } from "../../data-structures/maybe/Maybe";
import { assertJust } from "../../data-structures/assert/assert";

export type ComponentMeta = {
  key: Key;
  ctor: ComponentBuilder<any, any>;
  cache: Component<any>;
  ctx: CreoContext;
  children: LinkedHashMap<Key, ComponentMeta>;
  parent: ComponentMeta;
  mountedParent: any; // currently any, but should be an item, to which data can be mounted in reality
  mountedChildren: Array<any>; /// list of items which rendered that component in real UI
  beforeItem: any; // real rendered item before which this component places its own data
  status: ComponentStatus;
  nextChild: () => Maybe<ComponentMeta>;
  findByKey: (key: Key) => Maybe<ComponentMeta>;
  markDirty: () => void;
  destroy: () => void;
};

export function createComponentMeta<
  P extends object = {},
  A extends object = {},
>(
  ctor: ComponentBuilder<P, A>,
  params: P,
  maybeKey: Maybe<Key>,
  layout: LayoutEngine,
): ComponentMeta {
  const parent = layout.peekMeta();
  const key: Key = maybeKey ?? `creo-${parent.children.size}`;
  const subscribers: Array<() => void> = [];
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
      },
    },
    cache: null,
  };
  meta.cache = creoWrapperForComponent(ctor(params, meta.ctx), meta, layout);

  return meta;
}

function creoWrapperForComponent<A extends object = {}>(
  component: Component<A>,
  meta: ComponentMeta,
  layout: LayoutEngine,
): Component<A> {
  return {
    ...component,
    didMount() {
      component.didMount?.();
    },
    didUpdate() {
      component.didUpdate?.();
    },
    dispose() {
      component.dispose?.();
    },
    ui() {
      layout.pushMeta(meta);
      component.ui();
      layout.popMeta();
    },
  };
}

enum ComponentStatus {
  dirty,
  parentUpdating,
  updating,
  clear,
}

export function creo<P extends object = {}, A extends object = {}>(
  ctor: ComponentBuilder<P, A>,
): CreoComponent<P, A> {
  return (params: P) => {
    // 1. Get rendering context
    const maybeLayout = getLayoutEngine();
    assertJust(
      maybeLayout,
      "Component can be initialised only inside creo rendering cycle",
    );
    const layout: LayoutEngine = maybeLayout;

    // 2. Check if there is an existing component
    let key: Maybe<Key>;
    // If key is provided separately, use provided key:
    // @ts-ignore
    if (typeof params === "object" && params.key != null) {
      // @ts-ignore
      key = params.key;
    }

    const parentMeta = layout.peekMeta();

    // TODO use findByKey,if the key is defined
    const nextComponent = parentMeta.nextChild();

    let componentMeta: ComponentMeta;

    if (
      !nextComponent ||
      nextComponent.ctor !== ctor ||
      (isJust(key) && isJust(nextComponent.key) && key != nextComponent.key)
    ) {
      componentMeta = createComponentMeta(ctor, params, key, layout);
    } else {
      componentMeta = nextComponent;
    }

    return componentMeta.cache;
  };
}

export type Key = number | string;

type Wildcard = any;

export type CreoContext = {
  tracked: <T extends {}>(t: T) => RecordOf<T>;
};

export type CreoComponent<P = void, A extends object = {}> = (
  p: P,
) => Component<A>;

export type Component<A extends object = {}> = {
  ui(): void;
  didMount?(): void;
  didUpdate?(): void;
  dispose?(): void;
} & A;

export type ComponentBuilder<P = void, A extends object = {}> = (
  p: P,
  c: CreoContext,
) => Component<A>;
