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
import { onDidUpdate, record, RecordOf } from "../data-structures/record/Record";
import type * as CSS from 'csstype';
import { getLayoutEngine, LayoutEngine } from "../layout-engine/layoutEngine";
import { isNone } from "../data-structures/maybe/Maybe";

export function creo<T extends { new (...args: any): InstanceType<T> }>(
  ctor: T
) {
  // @ts-ignore
  return new Proxy(ctor, {
    get(target, prop, _receiver) {
      // @ts-ignore
      return target[prop];
    },
    set(target, prop, newValue, _receiver) {
      // @ts-ignore
      target[prop] = newValue;
      return true;
    },
    apply(Ctor, _self, args: ConstructorParameters<T>) {
      return construct(Ctor, args);
    },
    // @ts-ignore
    construct(Ctor, argArray: ConstructorParameters<T>, _newTarget) {
      return construct(Ctor, argArray);
    },
  });

  function construct(Ctor: T, params: ConstructorParameters<T>) {
    // 1. Get rendering context
    // 2. Check if there is an existing component
    // 3. Update existing component if any
    // 4. Creo component if there are none
    const instance = new Ctor(...params);
    // 5. Mark component dirty if:
    // 5.1. Props are changed
    // 5.2. Tracked properties are changed

    return instance;
  }
}

type Wildcard = any;

export abstract class Component<P = void> {
  private c_parent: Component<Wildcard>;
  private c_items: LinkedHashMap<Component<Wildcard>>;
  private c_engine: LayoutEngine;
  protected props: P;

  constructor(props: P | null = null) {
    // @ts-ignore
    this.props = props;
    const maybeEngine = getLayoutEngine();
    if (isNone(maybeEngine)) {
      throw new Error('Cannot initialise component with no layout engine defined');
    }
    this.c_engine = maybeEngine;
  }

  private c_ui() {

  }
  // Rendering method
  abstract ui(): void;

  // Cannot be changed
  protected track<T extends object>(tracked: RecordOf<T>): RecordOf<T> {
    onDidUpdate(tracked, () => {
      this.c_markDirty();
    });
    return tracked;
  }

  protected tracked<T extends object>(t: T): RecordOf<T> {
    const rec = record(t);
    onDidUpdate(rec, () => {
      this.c_markDirty();
    });
    return rec;
  }

  // Can be overwritten
  public didMount() {}
  // Can be overwritten
  public didUpdate() {}

  private c_markDirty() {

  }
}

export abstract class StyledComponent<Props = void> extends Component<Props> {
   constructor(props: Props | null = null) {
    super(props);
  }
  abstract with(slot: () => void): this;
  abstract style(styles: CSS.Properties | (() => CSS.Properties)): this;
}
