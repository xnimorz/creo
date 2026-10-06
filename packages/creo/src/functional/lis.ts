/** Indices of the longest strictly increasing subsequence, O(n log n). -1 entries are skipped. */
export function lis(arr: number[]): Set<number> {
  const len = arr.length;
  if (len === 0) return new Set();

  // tails[k] = index into arr of the smallest tail element for an IS of length k+1
  const tails: number[] = [];
  // prev[i] = index into arr of the predecessor of arr[i] in the LIS
  const prev = new Array<number>(len).fill(-1);

  for (let i = 0; i < len; i++) {
    if (arr[i]! < 0) continue;

    const val = arr[i]!;

    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[tails[mid]!]! < val) lo = mid + 1;
      else hi = mid;
    }

    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }

  const result = new Set<number>();
  if (tails.length === 0) return result;

  let idx = tails[tails.length - 1]!;
  for (let k = tails.length - 1; k >= 0; k--) {
    result.add(idx);
    idx = prev[idx]!;
  }

  return result;
}
