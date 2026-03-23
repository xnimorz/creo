import type { View } from "@/internal/internal_view";
import type { PrimitiveComponent } from "@/public/primitive";

/**
 * Handler for rendering a specific primitive.
 * Renderers implement one per primitive they support.
 */
export interface PrimitiveRenderHandler<Output> {
  render(view: View): Output;
}

export interface IRender<Output> {
  /** Create DOM if view is new (no renderRef), or update if existing. */
  render(view: View): void;

  /** Remove a view's output artifacts. Called from View[Symbol.dispose]. */
  unmount(view: View): void;

  /** Register render handlers for primitive components. */
  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<Output>][],
  ): void;
}
