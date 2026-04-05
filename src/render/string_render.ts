import type { ViewRecord } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

// Self-closing HTML tags (no closing tag)
const VOID_TAGS = new Set([
  "br", "hr", "img", "input", "source", "track", "embed",
  "area", "col", "wbr",
]);

/**
 * Stateless string renderer — pull-based.
 * render/unmount are no-ops. Call renderToString() to
 * get the current HTML string from the VDOM.
 */
export class StringRender implements IRender<string> {
  private root: Maybe<ViewRecord> = null;

  engine!: Engine;

  // -- IRender ----------------------------------------------------------------

  render(view: ViewRecord): void {
    if (!view.parent) {
      this.root = view;
    }
  }

  unmount(_view: ViewRecord): void {}

  // -- Public -----------------------------------------------------------------

  /** Build and return the current HTML string from the VDOM. */
  renderToString(): string {
    if (!this.root) return "";
    return this.buildString(this.root);
  }

  // -- Internal ---------------------------------------------------------------

  private buildString(rec: ViewRecord): string {
    const tag = rec.viewFn[$primitive];

    if (tag != null) {
      if (tag === "text") {
        return `${rec.props}`;
      }
      if (VOID_TAGS.has(tag)) {
        return this.buildVoidTag(tag, rec);
      }
      return `<${tag}>${this.buildChildren(rec)}</${tag}>`;
    }

    return this.buildChildren(rec);
  }

  private buildVoidTag(tag: string, rec: ViewRecord): string {
    const props = rec.props as Record<string, unknown>;
    let attrs = "";
    if (props.src) attrs += ` src="${props.src}"`;
    if (props.alt) attrs += ` alt="${props.alt}"`;
    return `<${tag}${attrs} />`;
  }

  private buildChildren(rec: ViewRecord): string {
    if (!rec.children) return "";
    let result = "";
    for (const child of rec.children) {
      result += this.buildString(child);
    }
    return result;
  }
}
