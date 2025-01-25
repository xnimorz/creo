/**
 * Assert helpers for ts
 * 
 */

import { isNone, Just, Maybe } from "../maybe/Maybe";

export function assertJust<T>(maybe: Maybe<T>, errorMessage?: string): asserts maybe is Just<T> {
  if (isNone(maybe)) {
    throw new Error(errorMessage ?? 'Expected Just, received None as Maybe');
  }
}