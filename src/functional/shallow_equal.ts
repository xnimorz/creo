import type { Wildcard } from "@/internal/wildcard";

export function shallowEqual(a: Wildcard, b: Wildcard): boolean {
  if (a === b) return true;

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  // Avoid Object.keys() allocations — use for...in instead
  let countA = 0;
  for (const key in a) {
    countA++;
    // @ts-ignore
    if (!Object.is(a[key], b[key])) return false;
  }

  let countB = 0;
  for (const _ in b) countB++;

  return countA === countB;
}
