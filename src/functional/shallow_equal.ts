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

  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    // @ts-ignore
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
}
