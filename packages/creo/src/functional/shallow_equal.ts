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

  // Count keys instead of Object.keys() to avoid allocations
  let countA = 0;
  for (const key in a) {
    countA++;
    if (a[key] === b[key]) continue;
    // `on` handler object compared one level deep
    if (key === "on" && shallowEqual(a[key], b[key])) continue;
    return false;
  }

  let countB = 0;
  for (const _ in b) {
    countB++;
    if (countB > countA) return false;
  }

  return countA === countB;
}
