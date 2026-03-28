import type { View } from "@/internal/internal_view";

export interface IRender<Output> {
  /** Create output if view is new (no renderRef), or update if existing. */
  render(view: View): void;

  /** Remove a view's output artifacts. Called from View[Symbol.dispose]. */
  unmount(view: View): void;
}
