/**
 * Assert helpers for ts
 * 
 */

import { isNone, Just, Maybe } from "../maybe/Maybe";

export function assertJust<T>(maybe: Maybe<T>): asserts maybe is Just<T> {
  if (isNone(maybe)) {
    throw new Error('Assertion for Maybe value fails');
  }
}