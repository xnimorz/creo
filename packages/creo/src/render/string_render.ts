import type { ViewRecord } from "@/internal/internal_view";
import { F_PRIMITIVE } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

// Self-closing HTML tags (no closing tag)
const VOID_TAGS = new Set([
  "br", "hr", "img", "input", "source", "track", "embed",
  "area", "col", "wbr",
]);

// Attributes that are set as DOM properties, not HTML attributes
const DOM_PROPERTIES = new Set(["value", "checked", "selected", "indeterminate", "muted"]);

// Event handler prefix detection
function isEventProp(key: string): boolean {
  return (
    key.charCodeAt(0) === 111 && // 'o'
    key.charCodeAt(1) === 110 && // 'n'
    key.charCodeAt(2) >= 65 &&   // 'A'
    key.charCodeAt(2) <= 90      // 'Z'
  );
}

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

/**
 * HtmlStringRender — pull-based string renderer.
 * render/unmount are no-ops. Call renderToString() to
 * get the current HTML string from the VDOM.
 *
 * Output matches HtmlRender's DOM serialization (innerHTML).
 */
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

    // Composite — transparent, just render children
    return this.buildChildren(rec);
  }

  private buildAttrs(props: Record<string, unknown>): string {
    let result = "";
    for (const key in props) {
      const value = props[key];
      if (key === "key" || value == null) continue;
      // Skip event handlers — they don't appear in HTML
      if (isEventProp(key)) continue;
      // Skip DOM-only properties (value, checked, etc.)
      if (DOM_PROPERTIES.has(key)) continue;

      if (key === "style") {
        // Normalize style to match DOM's cssText (trailing semicolon)
        let css = String(value);
        css = css.trim();
        if (css && !css.endsWith(";")) css += ";";
        result += ` style="${escapeAttr(css)}"`;
        continue;
      }
      if (typeof value === "boolean") {
        if (value) result += ` ${key}=""`;
        // false booleans are omitted
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

/** @deprecated Use HtmlStringRender instead */
export const StringRender = HtmlStringRender;
