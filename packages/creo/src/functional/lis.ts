/**
 * Longest Increasing Subsequence — O(n log n).
 *
 * Given an array of numbers, returns the Set of *indices* into that array
 * whose elements form the longest strictly increasing subsequence.
 * Entries equal to -1 are skipped (treated as "not present").
 *
 * Used by the keyed reconciler to identify the maximal set of children
 * that are already in correct relative order and don't need DOM moves.
 */
export function lis(arr: number[]): Set<number> {
  const len = arr.length;
  if (len === 0) return new Set();

  // tails[k] = index into arr of the smallest tail element for an IS of length k+1
  const tails: number[] = [];
  // prev[i] = index into arr of the predecessor of arr[i] in the LIS
  const prev = new Array<number>(len).fill(-1);

  for (let i = 0; i < len; i++) {
    if (arr[i]! < 0) continue; // skip -1 entries

    const val = arr[i]!;

    // Binary search for the leftmost tail >= val
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[tails[mid]!]! < val) lo = mid + 1;
      else hi = mid;
    }

    // lo is the position where val should go
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }

  // Backtrack from the last element of tails to reconstruct the LIS
  const result = new Set<number>();
  if (tails.length === 0) return result;

  let idx = tails[tails.length - 1]!;
  for (let k = tails.length - 1; k >= 0; k--) {
    result.add(idx);
    idx = prev[idx]!;
  }

  return result;
}
