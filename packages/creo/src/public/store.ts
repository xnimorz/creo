import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";
import { chainUpdate, type UpdateChain } from "@/functional/chain_update";

// Symbol.for so isStore() works across multiple bundles of creo (e.g. when
// a downstream library brings its own copy)
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
  // Lazily-built adapter for the shared chainUpdate algorithm.
  #chain: Maybe<UpdateChain<T>>;

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
        notify: () => this.#notify(),
      };
    }
    chainUpdate(chain, fn);
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
