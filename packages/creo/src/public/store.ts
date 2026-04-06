import type { MaybePromise } from "@/functional/maybe_promise";

const $store = Symbol("store");

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

  constructor(initial: T) {
    this.#current = initial;
  }

  get(): T {
    return this.#current;
  }

  set(value: T): void {
    this.#current = value;
    this.#notify();
  }

  update(fn: (current: T) => MaybePromise<T>): void {
    const result = fn(this.#current);
    if (result instanceof Promise) {
      result.then((value) => {
        this.#current = value;
        this.#notify();
      });
    } else {
      this.#current = result;
      this.#notify();
    }
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
