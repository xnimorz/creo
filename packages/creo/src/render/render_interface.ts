import type { ViewRecord } from "@/internal/internal_view";
import type { Engine } from "@/internal/engine";

export interface IRender<Output> {
  engine: Engine;
  /** Create output if view is new (no renderRef), or update if existing. */
  render(view: ViewRecord): void;

  /** Remove a view's output artifacts. */
  unmount(view: ViewRecord): void;

  /**
   * Optional: returns true if this primitive's live output may have
   * drifted from `nextProps` and needs re-rendering even though
   * `shallowEqual(prev, next)` reports props as unchanged.
   *
   * The DOM renderer uses this to detect user input that changed
   * the live DOM (e.g. typing in `<input value=…>`, toggling a
   * checkbox) without our state ever changing.
   *
   * Called only for primitives whose own props didn't change
   * shallowly — engines should treat absence of this method as
   * "nothing to re-assert".
   */
  shouldReassert?(view: ViewRecord, nextProps: unknown): boolean;
}
