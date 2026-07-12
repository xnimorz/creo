import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";
import { chainUpdate, type UpdateChain } from "@/functional/chain_update";

/**
 * Reactive value — the shared interface returned by `use()`.
 * Both local state and store bindings implement this.
 */
export interface Reactive<T> {
  get(): T;
  set(value: T): void;
  update(fn: (current: T) => MaybePromise<T>): void;
}

/**
 * A single reactive state slot.
 * Returned by calling use(initial) during view init.
 *
 *   const count = use(0);
 *   count.get()              // read current value
 *   count.set(5)             // set immediately, schedule render
 *   count.update(n => n + 1) // update via fn, schedule render
 *
 * Async updates chain: a second `update` issued while a previous async
 * update is still in flight runs against the previous update's result,
 * not against the snapshot at issue time. `set` cancels any pending
 * chain — its value becomes authoritative and in-flight links won't
 * commit afterwards.
 */
export class State<T> implements Reactive<T> {
  #current: T;
  #schedule: () => void;
  // Tail of the pending async update chain. Subsequent updates queue onto
  // it; `set` clears it to cancel any in-flight resolutions.
  #pending: Maybe<Promise<T>>;
  // Lazily-built adapter for the shared chainUpdate algorithm.
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

/**
 * Use factory bound to a view.
 * Tracks instances by call order (like React hooks).
 *
 * use(store)    — subscribe to a Store, returns Store<T> (Reactive<T>)
 * use(initial)  — create local State<T> (Reactive<T>)
 */
export type Use = {
  <T>(storeOrInitial: import("@/public/store").Store<T>): Reactive<T>;
  <T>(initial: T): Reactive<T>;
};
