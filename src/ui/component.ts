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

import { RecordOf, onDidUpdate } from "../data-structures/record/record";

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
      construct(Ctor, args);
    },
    // @ts-ignore
    construct(Ctor, argArray: ConstructorParameters<T>, _newTarget) {
      construct(Ctor, argArray);
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

export abstract class Component {
  // private #creo: CreoTree<Component>;

  constructor() {}

  // Rendering method
  abstract ui(): void;

  // Cannot be changed
  protected track<T extends object>(tracked: RecordOf<T>) {
    onDidUpdate(tracked, () => {
      // this.#creo.markDirty(this);
    });
  }

  // Can be overwritten
  public didMount() {}
  // Can be overwritten
  public didUpdate() {}
}

export abstract class StyledComponent extends Component {
  constructor() {
    super();
  }
  abstract with(slot: () => void): void;
}
