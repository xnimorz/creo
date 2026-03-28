import type { View } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";

// Self-closing HTML tags (no closing tag)
const VOID_TAGS = new Set([
  "br", "hr", "img", "input", "source", "track", "embed",
  "area", "col", "wbr",
]);

/**
 * Stateless string renderer — pull-based.
 * mount/unmount/update are no-ops. Call renderToString() to
 * get the current HTML string from the VDOM.
 */
export class StringRender implements IRender<string> {
  private rootView: Maybe<View>;

  // -- IRender ----------------------------------------------------------------

  render(view: View): void {
    if (!view.parent) {
      this.rootView = view;
    }
  }

  unmount(_view: View): void {}

  // -- Public -----------------------------------------------------------------

  /** Build and return the current HTML string from the VDOM. */
  renderToString(): string {
    if (!this.rootView) return "";
    return this.buildString(this.rootView);
  }

  // -- Internal ---------------------------------------------------------------

  private buildString(view: View): string {
    const tag = view.viewFn[$primitive];

    if (tag != null) {
      if (tag === "text") {
        return `${view.props}`;
      }
      if (VOID_TAGS.has(tag)) {
        return this.buildVoidTag(tag, view);
      }
      return `<${tag}>${this.buildChildren(view)}</${tag}>`;
    }

    return this.buildChildren(view);
  }

  private buildVoidTag(tag: string, view: View): string {
    const props = view.props as Record<string, unknown>;
    let attrs = "";
    if (props.src) attrs += ` src="${props.src}"`;
    if (props.alt) attrs += ` alt="${props.alt}"`;
    return `<${tag}${attrs} />`;
  }

  private buildChildren(view: View): string {
    let result = "";
    if (view.virtualDom) {
      for (const child of view.virtualDom) {
        result += this.buildString(child);
      }
    }
    return result;
  }
}
