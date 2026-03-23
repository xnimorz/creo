import type { IRender } from "@/render/render_interface";
import { View, type PendingView } from "./internal_view";
import { IndexedList } from "@/structures/indexed_list";
import type { Wildcard } from "./wildcard";

/**
 * Engine orchestrates the render cycle:
 *   1. Pick dirty views from needRender
 *   2. For each: renderer.render (create/update DOM), then view.render (VDOM reconciliation)
 *   3. Childless primitives are rendered immediately on creation
 *   4. Unmounts happen directly in View[Symbol.dispose]
 */
export class Engine {
  protected rendering = new IndexedList<View>();
  protected needRender = new IndexedList<View>();

  constructor(public renderer: IRender<Wildcard>) {}

  // -- View lifecycle ---------------------------------------------------------

  disposeView(view: View) {
    this.needRender.delete(view);
    this.rendering.delete(view);
  }

  renderBefore(view: View) {
    if (this.rendering.has(view)) {
      return;
    }
    this.needRender.delete(view);
    this.rendering.push(view);
  }

  renderAfter(view: View) {
    this.rendering.delete(view);
  }

  markNeedRender(view: View) {
    if (this.needRender.has(view) || this.rendering.has(view)) {
      return;
    }
    this.needRender.push(view);
  }

  /** Cursor for depth-first child insertion in needRender */
  #childCursor: View | null = null;

  register(view: View) {
    if (view.isPrimitive && view.ctx.slot == null) {
      // Childless primitive — render immediately (parent DOM exists), skip render queue
      this.renderer.render(view);
      return;
    }
    // Insert children right after previously registered sibling (depth-first)
    if (this.#childCursor) {
      this.needRender.insertAfter(this.#childCursor, view);
    } else {
      // First child — insert at front of queue (before remaining siblings)
      this.needRender.unshift(view);
    }
    this.#childCursor = view;
  }

  // -- Pending views ----------------------------------------------------------

  #pendingViewCache: Set<PendingView> = new Set();

  addToPendingViews(pendingView: PendingView) {
    this.#pendingViewCache.add(pendingView);
  }

  getPendingViews() {
    if (this.#pendingViewCache.size === 0) return this.#pendingViewCache;
    const pendingViews = this.#pendingViewCache;
    this.#pendingViewCache = new Set();
    return pendingViews;
  }

  // -- Render cycle -----------------------------------------------------------

  initialRender() {
    for (const p of this.getPendingViews()) {
      new View(p.viewFn, this, p.props, p.slot, null, null);
    }
    this.#processQueue();
  }

  #cycling = false;

  renderCycle() {
    if (this.#cycling) return;
    this.#cycling = true;
    try {
      this.#processQueue();
    } finally {
      this.#cycling = false;
    }
  }

  #mountAfter: View[] = [];

  #processQueue() {
    while (this.needRender.length > 0) {
      const view = this.needRender.first()!;

      const isNew = view.renderRef == null;

      // Create/update DOM first so children can be mounted during view.render()
      this.renderer.render(view);

      if (isNew && view.viewBody.mount?.after) {
        this.#mountAfter.push(view);
      }

      // Reset child cursor — children registered during render()
      // will be inserted at the front of the queue (depth-first order)
      this.#childCursor = null;

      // Run viewBody + reconcile children
      view.render();
    }

    // mount.after callbacks — after all DOM work is done
    const ma = this.#mountAfter;
    for (let i = 0; i < ma.length; i++) {
      ma[i]!.mountAfter();
    }
    ma.length = 0;
  }
}
