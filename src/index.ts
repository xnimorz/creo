// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export { createApp } from "@/public/app";

// ---------------------------------------------------------------------------
// View & State
// ---------------------------------------------------------------------------

export { view } from "@/public/view";
export type { ViewBody, ViewFn, Slot } from "@/public/view";
export type { StateFactory } from "@/public/state";
export { State } from "@/public/state";
export { Store } from "@/public/store";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export { primitive, $primitive } from "@/public/primitive";
export type { PrimitiveComponent, PrimitiveProps, EventHandlerProps } from "@/public/primitive";

export {
  // Factory
  html,
  getHtmlTag,
  // Text
  text,
  // Layout / structural
  div, span, section, article, aside, nav, header, footer, main,
  // Text / inline
  p, h1, h2, h3, h4, h5, h6, pre, code, em, strong, small, br, hr, a, blockquote, label,
  // Lists
  ul, ol, li,
  // Table
  table, thead, tbody, tfoot, tr, th, td,
  // Form
  form, button, input, textarea, select, option, fieldset, legend,
  // Media
  img, video, audio, canvas, source,
  // Other
  details, summary, dialog, iframe,
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

export type { IRender, PrimitiveRenderHandler } from "@/render/render_interface";
export { HtmlRender } from "@/render/html_render";
export { JsonRender } from "@/render/json_render";
export type { JsonNode } from "@/render/json_render";
export { StringRender } from "@/render/string_render";

// ---------------------------------------------------------------------------
// Engine (advanced — for custom renderer wiring)
// ---------------------------------------------------------------------------

export { Engine } from "@/internal/engine";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export { type Maybe, type None, type Just, just, withDefault, _ } from "@/functional/maybe";
export type { Key } from "@/functional/key";
export { shallowEqual } from "@/functional/shallow_equal";
export { assertNever } from "@/functional/assert";
