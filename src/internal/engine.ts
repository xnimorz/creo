import type { IRender } from "@/render/render_interface";
import type { PendingView, View } from "./internal_view";
import { List } from "@/structures/list";
import type { Wildcard } from "./wildcard";

/**
 * Engine keeps track on related views for this particular engine
 */
export class Engine {
  // Currently rendering views
  protected rendering: List<View> = new List<View>([]);

  // List of views marked as dirty, so that they need to be re-rendered
  protected needRender: List<View> = new List<View>([]);

  // Registry of all views related to this engine, so that we can find them by key
  protected registry: List<View> = new List<View>([]);

  // List of disposed views, that need to be cleaned up after rendering
  protected needDelete: List<View> = new List<View>([]);

  constructor(public renderer: IRender<Wildcard>) {}

  disposeView(view: View) {
    this.registry.delete(view);
    this.needRender.delete(view);
    this.rendering.delete(view);
    this.needDelete.push(view);
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

  register(view: View) {
    this.registry.push(view);
    this.needRender.push(view);
  }

  #pendingViewCache: PendingView[] = [];
  addToPendingViews(pendingView: PendingView) {
    this.#pendingViewCache.push(pendingView);
  }

  getPendingViews() {
    const pendingViews = this.#pendingViewCache;
    this.#pendingViewCache = [];
    return pendingViews;
  }

  // Debugging method to dump the current state of the engine
  dump() {}
}
