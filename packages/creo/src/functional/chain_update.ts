import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";

export interface UpdateChain<T> {
  getCurrent(): T;
  setCurrent(value: T): void;
  getPending(): Maybe<Promise<T>>;
  setPending(p: Maybe<Promise<T>>): void;
  notify(): void;
}

/**
 * Shared update() for State and Store. Async updates chain off the previous result;
 * `set` cancels the chain; a rejected tail clears `pending` and re-throws.
 */
export function chainUpdate<T>(
  host: UpdateChain<T>,
  fn: (current: T) => MaybePromise<T>,
): void {
  const pending = host.getPending();
  if (pending) {
    const next: Promise<T> = pending.then((v) => fn(v));
    host.setPending(next);
    next.then(
      (value) => {
        // A later update or `set` superseded us
        if (host.getPending() !== next) return;
        host.setPending(null);
        host.setCurrent(value);
        host.notify();
      },
      (err) => {
        if (host.getPending() === next) host.setPending(null);
        throw err;
      },
    );
    return;
  }

  const result = fn(host.getCurrent());
  if (!(result instanceof Promise)) {
    host.setCurrent(result);
    host.notify();
    return;
  }

  const captured = result;
  host.setPending(captured);
  captured.then(
    (value) => {
      if (host.getPending() !== captured) return;
      host.setPending(null);
      host.setCurrent(value);
      host.notify();
    },
    (err) => {
      if (host.getPending() === captured) host.setPending(null);
      throw err;
    },
  );
}
