import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";
import { chainUpdate, type UpdateChain } from "@/functional/chain_update";

/** Returned by `use()` for both local state and stores. */
export interface Reactive<T> {
  get(): T;
  set(value: T): void;
  update(fn: (current: T) => MaybePromise<T>): void;
}

/** Local state. Async `update`s chain on each other's result; `set` cancels in-flight ones. */
export class State<T> implements Reactive<T> {
  #current: T;
  #schedule: () => void;
  // Tail of the async update chain
  #pending: Maybe<Promise<T>>;
  #chain: Maybe<UpdateChain<T>>;

  constructor(initial: T, schedule: () => void) {
    this.#current = initial;
    this.#schedule = schedule;
  }

  get(): T {
    return this.#current;
  }

  set(value: T): void {
    this.#pending = null;
    this.#current = value;
    this.#schedule();
  }

  update(fn: (current: T) => MaybePromise<T>): void {
    let chain = this.#chain;
    if (!chain) {
      chain = this.#chain = {
        getCurrent: () => this.#current,
        setCurrent: (v) => {
          this.#current = v;
        },
        getPending: () => this.#pending,
        setPending: (p) => {
          this.#pending = p;
        },
        notify: () => this.#schedule(),
      };
    }
    chainUpdate(chain, fn);
  }
}

/** use(store) subscribes; use(initial) creates local state. */
export type Use = {
  <T>(storeOrInitial: import("@/public/store").Store<T>): Reactive<T>;
  <T>(initial: T): Reactive<T>;
};
