/**
 * HeightIndex — a Fenwick (binary indexed) tree over per-block heights so
 * that:
 *  - prefix(i)         — sum of heights[0..i)            in O(log n)
 *  - setHeight(i, h)   — replace heights[i] with h       in O(log n)
 *  - findIndexAtY(y)   — first i s.t. prefix(i+1) > y    in O(log n)
 *
 * Combined with an `estimatedHeight` for unmeasured blocks, this gives us
 * an O(log n) viewport-window resolver for arbitrary scroll positions even
 * before every block has been measured.
 */
export class HeightIndex {
  #n: number;
  #estimated: number;
  /** Fenwick tree of *delta* values (measured - estimated) per index. */
  #bit: Float64Array;
  /** Whether each index has been measured. */
  #measured: Uint8Array;
  /** Last measured height per index (used to maintain the BIT). */
  #measuredHeights: Float64Array;

  constructor(count: number, estimatedHeight: number) {
    this.#n = count;
    this.#estimated = estimatedHeight;
    this.#bit = new Float64Array(count + 1);
    this.#measured = new Uint8Array(count);
    this.#measuredHeights = new Float64Array(count);
  }

  get size(): number {
    return this.#n;
  }

  /** Replace the height at `i` with `h`. O(log n). */
  setHeight(i: number, h: number): void {
    if (i < 0 || i >= this.#n) return;
    const prev = this.#measured[i] ? this.#measuredHeights[i]! : this.#estimated;
    if (h === prev) {
      // No-op — but still mark as measured so subsequent estimated-fallback
      // queries don't double-count.
      this.#measured[i] = 1;
      this.#measuredHeights[i] = h;
      return;
    }
    const delta = h - prev;
    this.#measured[i] = 1;
    this.#measuredHeights[i] = h;
    // Update BIT: maintain prefix sums of (h_i - estimated).
    const prevDelta = (this.#measured[i] ? prev : this.#estimated) - this.#estimated;
    void prevDelta;
    // Easier: maintain BIT of *measured-or-zero* deltas. We added "delta"
    // relative to old contribution.
    this.#bitAdd(i + 1, delta);
  }

  /** Prefix sum of heights for indices [0, i). */
  prefix(i: number): number {
    if (i <= 0) return 0;
    if (i > this.#n) i = this.#n;
    return i * this.#estimated + this.#bitQuery(i);
  }

  /** Total height of all blocks. */
  total(): number {
    return this.prefix(this.#n);
  }

  /**
   * Find the smallest index i such that prefix(i+1) > y. Returns the
   * floor index for y in [0, total()); for y >= total() returns n - 1.
   * For empty trees returns 0 (caller should also check size).
   */
  findIndexAtY(y: number): number {
    if (this.#n === 0) return 0;
    if (y <= 0) return 0;
    if (y >= this.total()) return this.#n - 1;
    // Binary search using BIT — classic Fenwick lower_bound.
    // We're looking for: smallest i with prefix(i+1) > y, equivalently
    // first i with sum(1..i) > y.
    // Adapt for our prefix-with-estimated formula by binary searching
    // directly on prefix(i).
    let lo = 0;
    let hi = this.#n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.prefix(mid + 1) > y) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  /** Append `count` new blocks at the end, all unmeasured. */
  grow(count: number): void {
    if (count <= 0) return;
    this.resize(this.#n + count);
  }

  /**
   * Resize to exactly `count` blocks. Loses tail measurements when
   * shrinking; preserves them when growing. Always rebuilds the BIT from
   * scratch (cheap — O(n log n) and called rarely).
   */
  resize(count: number): void {
    if (count === this.#n) return;
    const keep = Math.min(count, this.#n);
    const newBit = new Float64Array(count + 1);
    const newMeasured = new Uint8Array(count);
    newMeasured.set(this.#measured.slice(0, keep));
    const newHeights = new Float64Array(count);
    newHeights.set(this.#measuredHeights.slice(0, keep));
    for (let i = 0; i < keep; i++) {
      if (newMeasured[i]) {
        const delta = newHeights[i]! - this.#estimated;
        if (delta !== 0) {
          let idx = i + 1;
          while (idx <= count) {
            newBit[idx] = (newBit[idx] ?? 0) + delta;
            idx += idx & -idx;
          }
        }
      }
    }
    this.#n = count;
    this.#bit = newBit;
    this.#measured = newMeasured;
    this.#measuredHeights = newHeights;
  }

  // ---- BIT internals ----

  #bitAdd(i: number, delta: number): void {
    while (i <= this.#n) {
      this.#bit[i] = (this.#bit[i] ?? 0) + delta;
      i += i & -i;
    }
  }

  #bitQuery(i: number): number {
    let s = 0;
    while (i > 0) {
      s += this.#bit[i] ?? 0;
      i -= i & -i;
    }
    return s;
  }
}
