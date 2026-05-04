import type { Maybe } from "@/functional/maybe";
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
    if (this.#pending) {
      // Queue onto the pending chain so this fn runs against the previous
      // update's result, not against #current at call time.
      const next: Promise<T> = this.#pending.then((v) => fn(v));
      this.#pending = next;
      next.then((value) => {
        // Skip if a later update or `set` moved the tail past us.
        if (this.#pending !== next) return;
        this.#pending = null;
        this.#current = value;
        this.#schedule();
      });
      return;
    }

    const result = fn(this.#current);
    if (!(result instanceof Promise)) {
      this.#current = result;
      this.#schedule();
      return;
    }

    const captured = result;
    this.#pending = captured;
    captured.then((value) => {
      if (this.#pending !== captured) return;
      this.#pending = null;
      this.#current = value;
      this.#schedule();
    });
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
