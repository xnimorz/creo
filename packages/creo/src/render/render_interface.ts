import type { ViewRecord } from "@/internal/internal_view";
import type { Engine } from "@/internal/engine";

export interface IRender<Output> {
  engine: Engine;
  /** Create output if view has no renderRef, else update. */
  render(view: ViewRecord): void;

  unmount(view: ViewRecord): void;

  /**
   * Optional: beginMount(root) → render() pre-order, attach() post-order → endMount(root).
   * `anchor` undefined = compute; the returned anchor is reused for following siblings.
   */
  beginMount?(root: ViewRecord, anchor?: unknown): unknown;
  attach?(view: ViewRecord): void;
  endMount?(root: ViewRecord): void;

  /** Optional: live output drifted from shallow-equal props (e.g. user typed into an input). */
  shouldReassert?(view: ViewRecord, nextProps: unknown): boolean;
}
