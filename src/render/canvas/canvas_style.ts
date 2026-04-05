import type { CanvasStyle, ResolvedStyle } from "./canvas_types";

// ---------------------------------------------------------------------------
// Default resolved style
// ---------------------------------------------------------------------------

const DEFAULTS: ResolvedStyle = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "stretch",
  alignSelf: "auto",
  flexGrow: 0,
  flexShrink: 1,
  flexBasis: "auto",
  flexWrap: "nowrap",
  gap: 0,

  width: "auto",
  height: "auto",
  minWidth: 0,
  minHeight: 0,
  maxWidth: Infinity,
  maxHeight: Infinity,

  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,

  position: "relative",
  top: "auto",
  left: "auto",
  right: "auto",
  bottom: "auto",

  backgroundColor: null,
  color: "#000000",
  opacity: 1,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: null,

  fontSize: 14,
  fontFamily: "sans-serif",
  fontWeight: "normal",
  textAlign: "left",
  lineHeight: 1.2,

  overflow: "visible",
  cursor: "default",
};

// ---------------------------------------------------------------------------
// Resolve a CanvasStyle into a full ResolvedStyle
// ---------------------------------------------------------------------------

function resolveOne(style: CanvasStyle): ResolvedStyle {
  const r = { ...DEFAULTS };

  for (const key in style) {
    const val = (style as Record<string, unknown>)[key];
    if (val === undefined) continue;

    // Shorthand: padding/margin expand to all four sides
    if (key === "padding") {
      r.paddingTop = r.paddingRight = r.paddingBottom = r.paddingLeft = val as number;
      continue;
    }
    if (key === "margin") {
      r.marginTop = r.marginRight = r.marginBottom = r.marginLeft = val as number;
      continue;
    }

    // Width/height: number → number, string "auto" → "auto", percentage strings → "auto" (for now)
    if (key === "width" || key === "height") {
      if (typeof val === "number") {
        (r as Record<string, unknown>)[key] = val;
      } else if (val === "auto" || typeof val === "string") {
        (r as Record<string, unknown>)[key] = "auto";
      }
      continue;
    }

    (r as Record<string, unknown>)[key] = val;
  }

  return r;
}

// ---------------------------------------------------------------------------
// Parse inline style string (subset: "key: value; key: value")
// ---------------------------------------------------------------------------

const STYLE_PROP_MAP: Record<string, string> = {
  "background-color": "backgroundColor",
  "background": "backgroundColor",
  "border-radius": "borderRadius",
  "border-width": "borderWidth",
  "border-color": "borderColor",
  "font-size": "fontSize",
  "font-family": "fontFamily",
  "font-weight": "fontWeight",
  "text-align": "textAlign",
  "line-height": "lineHeight",
  "flex-direction": "flexDirection",
  "justify-content": "justifyContent",
  "align-items": "alignItems",
  "align-self": "alignSelf",
  "flex-grow": "flexGrow",
  "flex-shrink": "flexShrink",
  "flex-basis": "flexBasis",
  "flex-wrap": "flexWrap",
  "min-width": "minWidth",
  "min-height": "minHeight",
  "max-width": "maxWidth",
  "max-height": "maxHeight",
  "padding-top": "paddingTop",
  "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom",
  "padding-left": "paddingLeft",
  "margin-top": "marginTop",
  "margin-right": "marginRight",
  "margin-bottom": "marginBottom",
  "margin-left": "marginLeft",
};

function parseInlineStyle(styleStr: string): CanvasStyle {
  const result: Record<string, unknown> = {};
  const parts = styleStr.split(";");
  for (const part of parts) {
    const colonIdx = part.indexOf(":");
    if (colonIdx === -1) continue;
    const rawKey = part.slice(0, colonIdx).trim();
    const rawVal = part.slice(colonIdx + 1).trim();
    if (!rawKey || !rawVal) continue;

    const key = STYLE_PROP_MAP[rawKey] ?? rawKey;

    // Try to parse as number (px values)
    if (rawVal.endsWith("px")) {
      result[key] = parseFloat(rawVal);
    } else if (!isNaN(Number(rawVal))) {
      result[key] = Number(rawVal);
    } else {
      result[key] = rawVal;
    }
  }
  return result as CanvasStyle;
}

// ---------------------------------------------------------------------------
// CanvasStyleSheet — maps class names to CanvasStyle objects
// ---------------------------------------------------------------------------

export class CanvasStyleSheet {
  #styles = new Map<string, CanvasStyle>();
  #cache = new Map<string, ResolvedStyle>();

  register(className: string, style: CanvasStyle): this {
    this.#styles.set(className, style);
    this.#cache.clear();
    return this;
  }

  registerAll(styles: Record<string, CanvasStyle>): this {
    for (const [name, style] of Object.entries(styles)) {
      this.#styles.set(name, style);
    }
    this.#cache.clear();
    return this;
  }

  get(className: string): CanvasStyle | undefined {
    return this.#styles.get(className);
  }

  resolve(classNames: string | undefined, inlineStyle: string | undefined): ResolvedStyle {
    const cacheKey = `${classNames ?? ""}|${inlineStyle ?? ""}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    // Merge: defaults ← class styles (left to right) ← inline
    const merged: CanvasStyle = {};

    if (classNames) {
      const names = classNames.split(/\s+/);
      for (const name of names) {
        if (!name) continue;
        const classStyle = this.#styles.get(name);
        if (classStyle) Object.assign(merged, classStyle);
      }
    }

    if (inlineStyle) {
      Object.assign(merged, parseInlineStyle(inlineStyle));
    }

    const resolved = resolveOne(merged);
    this.#cache.set(cacheKey, resolved);
    return resolved;
  }
}
