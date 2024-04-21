/**
 * Ideas:
 * [x] didUpdate support
 * [x] Proxy proxifies all children as well
 * [ ] Keep track on updates, until there are no users on the old state
 * [ ] Support symbol iterator
 * [ ] Add js dispose tracker to automatically close listeners
 */

import { isRecordLike } from "../tools/isRecordLike";

type Record<T extends object> = T;
type Wildcard = any;
type RecordDidChangeListener<T extends object> = (record: Record<T>) => void;

const didUpdateMap: WeakMap<
  Record<Wildcard>,
  Set<RecordDidChangeListener<Wildcard>>
> = new WeakMap();

const scheduledUpdatesNotifiers: Set<Record<Wildcard>> = new Set();
let shouldScheduleMicrotask = true;
function queuedNotifier() {
  shouldScheduleMicrotask = true;
  scheduledUpdatesNotifiers.forEach((record) => {
    const listeners = didUpdateMap.get(record);
    if (!listeners) {
      return;
    }
    listeners.forEach((listener) => {
      listener(record);
    });
  });
}
function recordDidUpdate<T extends object>(record: Record<T>) {
  scheduledUpdatesNotifiers.add(record);
  shouldScheduleMicrotask && queueMicrotask(queuedNotifier);
  shouldScheduleMicrotask = false;
}

function creoRecord<TNode extends object, T extends object>(
  rootRecord: Record<TNode>,
  value: T,
): Record<T> {
  return new Proxy(value, {
    // @ts-ignore we override `get` to improve typing
    get<K extends keyof T>(target: T, property: K): T[K] {
      const val = target[property];
      if (isRecordLike(val)) {
        // @ts-ignore we proxify all nested objects / arrays to ensure correct behaviour
        return creoRecord(rootRecord, val);
      }
      return val;
    },
    // @ts-ignore
    set<K, TNewValue>(target: T, property: K, newValue: TNewValue) {
      // @ts-ignore
      target[property] = newValue;
      recordDidUpdate(rootRecord);
      return true;
    },
  });
}

export function record<TNode extends object>(value: TNode): Record<TNode> {
  const rootRecord = new Proxy(value, {
    // @ts-ignore we override `get` to improve typing
    get<K extends keyof T>(target: T, property: K): T[K] {
      const val = target[property];
      if (isRecordLike(val)) {
        // @ts-ignore we proxify all nested objects / arrays to ensure correct behaviour
        return creoRecord(rootRecord, val);
      }
      return val;
    },
    // @ts-ignore
    set<K, TNewValue>(target: T, property: K, newValue: TNewValue) {
      // @ts-ignore
      target[property] = newValue;
      recordDidUpdate(rootRecord);
      return true;
    },
  });
  didUpdateMap.set(rootRecord, new Set());
  return rootRecord;
}

export function onDidUpdate<T extends object>(
  record: Record<T>,
  listener: (record: Record<T>) => void,
): () => void {
  const listeners = didUpdateMap.get(record);
  if (!listeners) {
    // Safe-guard: Essentialy this path cannot happen
    throw new TypeError(`Record ${record} was created without listener`);
  }
  listeners.add(listener);
  return function unsubscribe() {
    listeners.delete(listener);
  };
}
