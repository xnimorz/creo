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

  // Single-walk-with-count: avoid Object.keys() allocations and the slower
  // Object.is semantics (NaN/-0 distinctions don't matter for props).
  let countA = 0;
  for (const key in a) {
    countA++;
    if (a[key] === b[key]) continue;
    // One-level deeper for the conventional event-handler object.
    if (key === "on" && shallowEqual(a[key], b[key])) continue;
    return false;
  }

  let countB = 0;
  for (const _ in b) {
    countB++;
    // Early bail: b has at least one key not in a (since all a's keys
    // matched, any extra in b means counts must diverge).
    if (countB > countA) return false;
  }

  return countA === countB;
}
