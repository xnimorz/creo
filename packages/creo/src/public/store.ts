import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";

// Symbol.for so isStore() works across multiple bundles of creo (e.g. when
// a downstream library brings its own copy). A module-private Symbol() would
// make `use(storeFromOtherBundle)` silently degrade to a fresh State.
const $store = Symbol.for("creo.store");

/**
 * Store — globally visible reactive data.
 *
 * Create a store:
 *   const ThemeStore = store.new("light");
 *
 * Set from anywhere:
 *   ThemeStore.set("dark"); // updates all subscribers
 *
 * Read from a view:
 *   const myView = view(({ use }) => {
 *     const theme = use(ThemeStore); // re-renders on change
 *     return {
 *       render() {
 *         div(() => text(`Current theme: ${theme.get()}`));
 *       }
 *     };
 *   });
 */
export class Store<T> {
  readonly [$store] = true;
  #current: T;
  #subscribers = new Set<() => void>();
  // Tail of the pending async update chain. Subsequent updates queue onto
  // it; `set` clears it to cancel any in-flight resolutions.
  #pending: Maybe<Promise<T>>;

  constructor(initial: T) {
    this.#current = initial;
  }

  get(): T {
    return this.#current;
  }

  set(value: T): void {
    this.#pending = null;
    this.#current = value;
    this.#notify();
  }

  update(fn: (current: T) => MaybePromise<T>): void {
    if (this.#pending) {
      const next: Promise<T> = this.#pending.then((v) => fn(v));
      this.#pending = next;
      next.then((value) => {
        if (this.#pending !== next) return;
        this.#pending = null;
        this.#current = value;
        this.#notify();
      });
      return;
    }

    const result = fn(this.#current);
    if (!(result instanceof Promise)) {
      this.#current = result;
      this.#notify();
      return;
    }

    const captured = result;
    this.#pending = captured;
    captured.then((value) => {
      if (this.#pending !== captured) return;
      this.#pending = null;
      this.#current = value;
      this.#notify();
    });
  }

  subscribe(cb: () => void): () => void {
    this.#subscribers.add(cb);
    return () => {
      this.#subscribers.delete(cb);
    };
  }

  #notify(): void {
    for (const sub of this.#subscribers) {
      sub();
    }
  }
}

export function isStore(value: unknown): value is Store<unknown> {
  return value != null && typeof value === "object" && $store in value;
}

export const store = {
  new<T>(initial: T): Store<T> {
    return new Store(initial);
  },
};
