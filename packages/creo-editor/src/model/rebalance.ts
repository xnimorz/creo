import type { Store } from "creo";
import { maybeRebalance } from "./doc";
import type { DocState } from "./types";

/**
 * Watch a docStore and schedule a microtask rebalance whenever any
 * fractional index grows past the soft threshold.
 *
 * Rebalance assigns fresh, evenly-spaced indices to every block (preserving
 * order). It's O(n) and runs at most once per microtask, so worst-case a
 * 600k-block doc rebalances in ~50ms — and only ever triggers under
 * adversarial insertion patterns.
 */
export function attachAutoRebalance(
  docStore: Store<DocState>,
): () => void {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const cur = docStore.get();
      const next = maybeRebalance(cur);
      if (next !== cur) docStore.set(next);
    });
  };
  return docStore.subscribe(schedule);
}
