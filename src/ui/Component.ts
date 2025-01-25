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

import { LinkedHashMap } from "../data-structures/linked-hash-map/LinkedHashMap";
import { isRecord, onDidUpdate, record, RecordOf } from "../data-structures/record/Record";
import type * as CSS from 'csstype';
import { ComponentMeta, createComponentMeta, getLayoutEngine, LayoutEngine } from "../layout-engine/layoutEngine";
import { isJust, isNone, Maybe } from "../data-structures/maybe/Maybe";
import { assertJust } from "../data-structures/assert/assert";


export function creo<P extends object = {}, A extends object = {}>(ctor: ComponentBuilder<P, A>): CreoComponent<P, A> {
  return (params: P) => {        
    // 1. Get rendering context
    const maybeLayout = getLayoutEngine();
    assertJust(maybeLayout, 'Component can be initialised only inside creo rendering cycle');        
    const layout: LayoutEngine = maybeLayout;
    
    // 2. Check if there is an existing component
    let key: Maybe<Key>;
    // If key is provided separately, use provided key:
    // @ts-ignore
    if (typeof params === 'object' && params.key != null) {
      // @ts-ignore
      key = params.key;
    }
    
    const parentMeta = layout.peekMeta();

    // TODO use findByKey,if the key is defined
    const nextComponent = parentMeta.nextChild();
  
    let componentMeta: ComponentMeta;

    if (!nextComponent || nextComponent.ctor !== ctor || (isJust(key) &&  isJust(nextComponent.key) && key != nextComponent.key)) {
        componentMeta = createComponentMeta(ctor, params, key, layout);
    } else {
      componentMeta = nextComponent;
    }
    return componentMeta.cache;    
  }
}

export type Key = number | string;

type Wildcard = any;

export type CreoContext = {
  tracked: <T extends {}>(t: T) => RecordOf<T>,  
}

export type CreoComponent<P = void, A extends object = {}> = (p: P) => Component<A>;

export type Component<A extends object = {}> = {
  ui(): void,
  didMount?(): void,
  didUpdate?(): void,  
} & A;

export type ComponentBuilder<P = void, A extends object = {}> = (p: P, c: CreoContext) => Component<A>;