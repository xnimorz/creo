import type { Maybe } from "@/functional/maybe";
import type { MaybePromise } from "@/functional/maybe_promise";

/** Host hooks for the shared async-chain update algorithm. */
export interface UpdateChain<T> {
  getCurrent(): T;
  setCurrent(value: T): void;
  getPending(): Maybe<Promise<T>>;
  setPending(p: Maybe<Promise<T>>): void;
  notify(): void;
}

/**
 * Shared `update()` logic for State and Store.
 *
 * Async updates chain: a second update issued while a previous async update is
 * still in flight runs against the previous update's result, not against the
 * snapshot at issue time. `set` clears `pending` to cancel any in-flight links.
 *
 * If a link rejects, the chain is unwedged — when the rejected link is still
 * the tail, `pending` is cleared so the next `update()` starts a fresh chain
 * instead of chaining off a rejected promise (which would never commit again).
 * The error is re-thrown so it surfaces rather than being silently swallowed.
 */
export function chainUpdate<T>(
  host: UpdateChain<T>,
  fn: (current: T) => MaybePromise<T>,
): void {
  const pending = host.getPending();
  if (pending) {
    // Queue onto the pending chain so this fn runs against the previous
    // update's result, not against the current value at call time.
    const next: Promise<T> = pending.then((v) => fn(v));
    host.setPending(next);
    next.then(
      (value) => {
        // Skip if a later update or `set` moved the tail past us.
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
