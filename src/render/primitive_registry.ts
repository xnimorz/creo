import type { PrimitiveComponent } from "@/public/primitive";
import type { ViewFn } from "@/public/view";
import type { Wildcard } from "@/internal/wildcard";
import type { PrimitiveRenderHandler } from "./render_interface";
import type { Maybe } from "@/functional/maybe";

/**
 * Registry mapping primitive viewFns to their render handlers.
 * The viewFn reference is the key — Option A (viewFn as identity).
 */
export class PrimitiveRegistry<Output> {
  private handlers = new Map<
    ViewFn<Wildcard, Wildcard>,
    PrimitiveRenderHandler<Output>
  >();

  register(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<Output>][],
  ): void {
    for (const [primitive, handler] of entries) {
      this.handlers.set(
        primitive.viewFn as ViewFn<Wildcard, Wildcard>,
        handler,
      );
    }
  }

  getHandler(
    viewFn: ViewFn<Wildcard, Wildcard>,
  ): Maybe<PrimitiveRenderHandler<Output>> {
    return this.handlers.get(viewFn);
  }

  isPrimitive(viewFn: ViewFn<Wildcard, Wildcard>): boolean {
    return this.handlers.has(viewFn);
  }
}
