import type { MaybePromise } from "@/functional/maybe_promise";

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
 */
export class State<T> implements Reactive<T> {
  #current: T;
  #schedule: () => void;

  constructor(initial: T, schedule: () => void) {
    this.#current = initial;
    this.#schedule = schedule;
  }

  get(): T {
    return this.#current;
  }

  set(value: T): void {
    this.#current = value;
    this.#schedule();
  }

  update(fn: (current: T) => MaybePromise<T>): void {
    const result = fn(this.#current);
    if (result instanceof Promise) {
      result.then((value) => {
        this.#current = value;
        this.#schedule();
      });
    } else {
      this.#current = result;
      this.#schedule();
    }
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
