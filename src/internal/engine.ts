import type { IRender } from "@/render/render_interface";
import type { PendingView, View } from "./internal_view";
import { List } from "@/structures/list";
import { version } from "bun";

/**
 * Engine keeps track on related views for this particular engine
 */
export class Engine {
  // Currently rendering views
  protected rendering: List<View> = new List<View>([]);

  // List of views marked as dirty, so that they need to be re-rendered
  protected need_render: List<View> = new List<View>([]);

  // Registry of all views related to this engine, so that we can find them by key
  protected registry: List<View> = new List<View>([]);

  // List of disposed views, that need to be cleaned up after rendering
  protected need_delete: List<View> = new List<View>([]);

  constructor(public renderer: IRender) {}

  dispose_view(view: View) {
    this.registry.delete(view);
    this.need_render.delete(view);
    this.rendering.delete(view);
    this.need_delete.push(view);
  }

  render_before(view: View) {
    if (this.rendering.has(view)) {
      return;
    }
    this.need_render.delete(view);
    this.rendering.push(view);
  }

  render_after(view: View) {
    this.rendering.delete(view);
  }

  mark_need_render(view: View) {
    if (this.need_render.has(view) || this.rendering.has(view)) {
      return;
    }
    this.need_render.push(view);
  }

  register(view: View) {
    this.registry.push(view);
    this.need_render.push(view);
  }

  #pending_view_cache: PendingView[] = [];
  add_to_pending_views(pending_view: PendingView) {
    this.#pending_view_cache.push(pending_view);
  }

  get_pending_views() {
    const pending_views = this.#pending_view_cache;
    this.#pending_view_cache = [];
    return pending_views;
  }

  // Debugging method to dump the current state of the engine
  dump() {}
}
