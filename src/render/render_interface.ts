import type { ViewRecord } from "@/internal/internal_view";
import type { Engine } from "@/internal/engine";

export interface IRender<Output> {
  engine: Engine;
  /** Create output if view is new (no renderRef), or update if existing. */
  render(view: ViewRecord): void;

  /** Remove a view's output artifacts. */
  unmount(view: ViewRecord): void;
}
