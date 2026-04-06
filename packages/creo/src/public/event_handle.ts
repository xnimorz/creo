import type { Wildcard } from "@/internal/wildcard";

type EventCallback = (...args: Wildcard[]) => void;

/**
 * Delegate that the renderer provides to wire event subscriptions
 * to the actual output (DOM addEventListener, etc.).
 * Set on the EventHandle after the view's output is created.
 */
export type EventDelegate = {
  bind(event: string, callback: EventCallback, once?: boolean): void;
  unbind(event: string, callback: EventCallback): void;
};

/**
 * Handle returned when calling a primitive in the render stream.
 * Provides on/once/off for event subscription.
 *
 * When a delegate is set (by the renderer after mount), calls are
 * proxied to the renderer — only events the user subscribes to
 * get bound. Before the delegate exists, listeners are stored and
 * flushed once the delegate arrives.
 */
export class EventHandle<Events> {
  #listeners = new Map<keyof Events, Set<EventCallback>>();
  #onceListeners = new Map<keyof Events, Set<EventCallback>>();
  #delegate?: EventDelegate;

  on<K extends keyof Events>(event: K, callback: Events[K]): void {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    (this.#listeners.get(event) as Set<EventCallback>).add(
      callback as EventCallback,
    );
    this.#delegate?.bind(event as string, callback as EventCallback);
  }

  once<K extends keyof Events>(event: K, callback: Events[K]): void {
    if (!this.#onceListeners.has(event)) {
      this.#onceListeners.set(event, new Set());
    }
    (this.#onceListeners.get(event) as Set<EventCallback>).add(
      callback as EventCallback,
    );
    this.#delegate?.bind(event as string, callback as EventCallback, true);
  }

  off<K extends keyof Events>(event: K, callback: Events[K]): void {
    this.#listeners.get(event)?.delete(callback as EventCallback);
    this.#onceListeners.get(event)?.delete(callback as EventCallback);
    this.#delegate?.unbind(event as string, callback as EventCallback);
  }

  /**
   * Called by the renderer after the view's output is created.
   * Flushes any listeners that were added before the delegate existed.
   */
  setDelegate(delegate: EventDelegate): void {
    this.#delegate = delegate;
    for (const [event, callbacks] of this.#listeners) {
      for (const cb of callbacks) {
        delegate.bind(event as string, cb);
      }
    }
    for (const [event, callbacks] of this.#onceListeners) {
      for (const cb of callbacks) {
        delegate.bind(event as string, cb, true);
      }
    }
  }
}
