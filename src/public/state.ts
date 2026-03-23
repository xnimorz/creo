import type { View } from "@/internal/internal_view";
import type { MaybePromise } from "@/functional/maybe_promise";

const NO_PENDING = Symbol();

/**
 * A single reactive state slot.
 * Returned by calling state(initial) during view init.
 *
 *   const count = state(0);
 *   count.get()              // read committed value
 *   count.set(5)             // queues — applied before next render
 *   count.update(n => n + 1) // queues via fn — chains through pending
 *   count.update(async n => fetch(..))  // async — queues when resolved
 */
export class State<T> {
  #current: T;
  #pending: T | typeof NO_PENDING = NO_PENDING;
  #schedule: () => void;

  constructor(initial: T, schedule: () => void) {
    this.#current = initial;
    this.#schedule = schedule;
  }

  get(): T {
    return this.#current;
  }

  set(value: T): void {
    this.#pending = value;
    this.#schedule();
  }

  update(fn: (current: T) => MaybePromise<T>): void {
    const base =
      this.#pending !== NO_PENDING ? (this.#pending as T) : this.#current;
    const result = fn(base);
    if (result instanceof Promise) {
      result.then((value) => {
        this.#pending = value;
        this.#schedule();
      });
    } else {
      this.#pending = result;
      this.#schedule();
    }
  }

  /** @internal Apply pending value. Called by the framework before render. */
  flush(): void {
    if (this.#pending !== NO_PENDING) {
      this.#current = this.#pending as T;
      this.#pending = NO_PENDING;
    }
  }
}

/**
 * State factory bound to a view.
 * Tracks instances by call order (like React hooks).
 * On first render state(initial) creates a new instance.
 * On re-renders state(initial) returns the existing instance
 * at the same position (initial is ignored).
 */
export type StateFactory = <T>(initial: T) => State<T>;

export function createStateFactory(view: View): {
  state: StateFactory;
  flush: () => void;
} {
  let scheduled = false;
  let cursor = 0;
  const instances: State<unknown>[] = [];

  function schedule() {
    view.engine.markNeedRender(view);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        view.engine.renderCycle();
      });
    }
  }

  function state<T>(initial: T): State<T> {
    if (cursor < instances.length) {
      return instances[cursor++] as State<T>;
    }
    const instance = new State(initial, schedule);
    instances.push(instance as State<unknown>);
    cursor++;
    return instance;
  }

  function flush() {
    cursor = 0;
    for (const instance of instances) instance.flush();
  }

  return { state, flush };
}
