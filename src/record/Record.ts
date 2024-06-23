/**
 * Ideas:
 * [x] didUpdate support
 * [x] Proxy proxifies all children as well
 * [x] Support nested updates + nested listeners (e.g. only part of the object)
 * [x] Cache records
 * [ ] Keep track on updates, until there are no users on the old state
 * [ ] Support symbol iterator
 * [ ] Add js dispose tracker to automatically close listeners
 */

import { Maybe } from "../tools/Maybe";
import { isRecordLike } from "./IsRecordLike";

const ParentRecord = Symbol('parent-record');
// const example: RecordOf<{foo: 'bar'}> = {
//   foo: 'bar',
//   [ParentRecord]: null // Root record
// }
export type RecordOf<T extends object> = T & {[ParentRecord]: Maybe<WeakRef<RecordOf<Wildcard>>>};
type Wildcard = any;
type RecordDidChangeListener<T extends object> = (record: RecordOf<T>) => void;

const didUpdateMap: WeakMap<
  RecordOf<Wildcard>,
  Set<RecordDidChangeListener<Wildcard>>
> = new WeakMap();

const scheduledUpdatesNotifiers: Set<RecordOf<Wildcard>> = new Set();
let shouldScheduleMicrotask = true;
function queuedNotifier() {
  function iterate(record: RecordOf<Wildcard>) {
    const listeners = didUpdateMap.get(record);       
    listeners?.forEach((listener) => {
      listener(record);
    });
    const maybeParent: Maybe<RecordOf<Wildcard>> = record[ParentRecord];
    if (maybeParent) {
      iterate(maybeParent);
    }
  }
  shouldScheduleMicrotask = true;
  scheduledUpdatesNotifiers.forEach(iterate);
}
function recordDidUpdate<T extends object>(record: RecordOf<T>) {
  scheduledUpdatesNotifiers.add(record);
  shouldScheduleMicrotask && queueMicrotask(queuedNotifier);
  shouldScheduleMicrotask = false;
}

type InternalOnly = never;

function creoRecord<TNode extends object, T extends object>(  
  parent: Maybe<RecordOf<TNode>>,
  value: T,  
): RecordOf<T> {  
  const parentWeakRef = parent != null ? new WeakRef(parent) : null;
  
  type CacheField<K extends keyof T> = T[K] extends object ? Maybe<RecordOf<T[K]>> : never
  type Cache = { [K in keyof T]: CacheField<K> };
  const cache: Cache = {} as Cache;  
  const record: RecordOf<T> = new Proxy(value, {
    // @ts-ignore we override `get` to improve typing
    get<K extends keyof T>(target: T, property: K): T[K] {
      const val = target[property];

      if (property === ParentRecord) {
        // Only for internal use
        return parentWeakRef?.deref() as InternalOnly;
      }
      // If the value is cached, return the cached record:      
      if (cache[property] != null) {        
        return cache[property] as T[K];
      }
      // No cached value:
      if (isRecordLike(val)) {
        // Object / Array, etc.
        // we proxify all nested objects / arrays to ensure correct behaviour
        const childRecord = creoRecord(record, val);    
        cache[property] = childRecord as CacheField<K>;
        return childRecord;
      }

      // Primitive value:
      return val;
    },    
    set<K, TNewValue>(target: T, property: K, newValue: TNewValue) {      
      // property is actually the keyof K, but TS defines Proxy differently:
      const prop: keyof T = property as keyof T;      
      const value: T[typeof prop] = newValue as T[typeof prop];

      target[prop] = value;            
      if (cache[prop] != null) {
        cache[prop] = null as Cache[keyof Cache];
      }
      recordDidUpdate(record);
      return true;
    },
  }) as RecordOf<T>;

  return record;
}

export function record<TNode extends object>(value: TNode): RecordOf<TNode> {
  const record: RecordOf<TNode> = creoRecord(null, value);
  didUpdateMap.set(record, new Set());
  return record;
}

export function onDidUpdate<T extends object>(
  record: RecordOf<T>,
  listener: (record: RecordOf<T>) => void
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
