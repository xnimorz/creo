import type { ViewRecord } from "@/internal/internal_view";
import { F_PRIMITIVE } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

const VOID_TAGS = new Set([
  "br", "hr", "img", "input", "source", "track", "embed",
  "area", "col", "wbr",
]);

// Set as DOM properties, never serialized
const DOM_PROPERTIES = new Set(["value", "checked", "selected", "indeterminate", "muted"]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Pull-based: render/unmount are no-ops; renderToString() matches HtmlRender's innerHTML. */
export class HtmlStringRender implements IRender<string> {
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

  renderToString(): string {
    if (!this.root) return "";
    return this.buildString(this.root);
  }

  // -- Internal ---------------------------------------------------------------

  private buildString(rec: ViewRecord): string {
    const tag = rec.viewFn[$primitive];

    if (tag != null) {
      if (tag === "text") {
        return escapeHtml(String(rec.props));
      }
      const attrs = this.buildAttrs(rec.props as Record<string, unknown>);
      if (VOID_TAGS.has(tag)) {
        return `<${tag}${attrs}>`;
      }
      return `<${tag}${attrs}>${this.buildChildren(rec)}</${tag}>`;
    }

    return this.buildChildren(rec);
  }

  private buildAttrs(props: Record<string, unknown>): string {
    if (props == null) return "";
    let result = "";
    for (const key in props) {
      const value = props[key];
      if (key === "key" || value == null) continue;
      if (key === "on" || key === "ref") continue;
      if (DOM_PROPERTIES.has(key)) continue;

      if (key === "style") {
        // Match DOM cssText's trailing semicolon
        let css = String(value);
        css = css.trim();
        if (css && !css.endsWith(";")) css += ";";
        result += ` style="${escapeAttr(css)}"`;
        continue;
      }
      if (typeof value === "boolean") {
        if (value) result += ` ${key}=""`;
      } else {
        const attrName = key === "class" ? "class" : key;
        result += ` ${attrName}="${escapeAttr(String(value))}"`;
      }
    }
    return result;
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
