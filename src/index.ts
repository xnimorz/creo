// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export { createApp } from "@/public/app";

// ---------------------------------------------------------------------------
// View & State
// ---------------------------------------------------------------------------

export { view } from "@/public/view";
export type { ViewBody, ViewFn, Slot, PublicView } from "@/public/view";
export type { Reactive, Use } from "@/public/state";
export { State } from "@/public/state";
export { Store, store, isStore } from "@/public/store";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export { $primitive } from "@/public/primitive";
export type { PrimitiveProps, EventHandlerProps } from "@/public/primitive";

export {
  // Factory
  html,
  // Element api type
  type ElementApi,
  // Text
  text,
  // Layout / structural
  div, span, section, article, aside, nav, header, footer, main,
  // Sectioning
  address, hgroup, search,
  // Text / inline
  p, h1, h2, h3, h4, h5, h6, pre, code, em, strong, small, br, hr, a, blockquote, label,
  // Text semantics
  abbr, b, bdi, bdo, cite, data, dfn, i, kbd, mark, q, rp, rt, ruby, s, samp, sub, sup, time, u, varEl, wbr,
  // Demarcating edits
  del, ins,
  // Lists
  ul, ol, li, dl, dt, dd,
  // Table
  table, thead, tbody, tfoot, tr, th, td, caption, colgroup, col,
  // Form
  form, button, input, textarea, select, option, fieldset, legend, datalist, optgroup, output, progress, meter,
  // Media
  img, video, audio, canvas, source, track, map, area, picture,
  // Embedded
  iframe, embed, object, portal, svg,
  // Interactive
  details, summary, dialog, menu,
  // Figure
  figure, figcaption,
  // Scripting
  script, noscript, template, slot,
} from "@/public/primitives/primitives";

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type {
  BaseEventData,
  PointerEventData,
  KeyEventData,
  InputEventData,
  FocusEventData,
  ContainerEvents,
  FormEvents,
  HtmlAttrs,
} from "@/public/primitives/primitives";

// ---------------------------------------------------------------------------
// Renderer interface (for custom renderers)
// ---------------------------------------------------------------------------

export type { IRender } from "@/render/render_interface";
export { HtmlRender } from "@/render/html_render";
export { JsonRender } from "@/render/json_render";
export type { JsonNode } from "@/render/json_render";
export { HtmlStringRender, StringRender } from "@/render/string_render";

// ---------------------------------------------------------------------------
// Engine (advanced — for custom renderer wiring)
// ---------------------------------------------------------------------------

export { Engine, type Scheduler } from "@/internal/engine";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { type Maybe, type None, type Just, just, withDefault, _ } from "@/functional/maybe";
export type { Key } from "@/functional/key";
export { shallowEqual } from "@/functional/shallow_equal";
export { assertNever } from "@/functional/assert";
