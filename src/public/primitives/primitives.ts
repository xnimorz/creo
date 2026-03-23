import { primitive } from "../primitive";
import type { PrimitiveComponent } from "../primitive";
import type { ViewFn } from "../view";
import type { Wildcard } from "@/internal/wildcard";

// ---------------------------------------------------------------------------
// Engine-agnostic event data types
// ---------------------------------------------------------------------------

export type BaseEventData = {
  stopPropagation: () => void;
  preventDefault: () => void;
};

export type PointerEventData = BaseEventData & {
  x: number;
  y: number;
};

export type KeyEventData = BaseEventData & {
  key: string;
  code: string;
};

export type InputEventData = BaseEventData & {
  value: string;
};

export type FocusEventData = BaseEventData;

// ---------------------------------------------------------------------------
// Event maps
// ---------------------------------------------------------------------------

export type ContainerEvents = {
  click: (e: PointerEventData) => void;
  dblclick: (e: PointerEventData) => void;
  pointerDown: (e: PointerEventData) => void;
  pointerUp: (e: PointerEventData) => void;
  pointerMove: (e: PointerEventData) => void;
  keyDown: (e: KeyEventData) => void;
  keyUp: (e: KeyEventData) => void;
  focus: (e: FocusEventData) => void;
  blur: (e: FocusEventData) => void;
};

export type FormEvents = ContainerEvents & {
  input: (e: InputEventData) => void;
  change: (e: InputEventData) => void;
  keyDown: (e: KeyEventData) => void;
  keyUp: (e: KeyEventData) => void;
};

// ---------------------------------------------------------------------------
// Common HTML attributes
// ---------------------------------------------------------------------------

export type HtmlAttrs = {
  class?: string;
  id?: string;
  style?: string;
  title?: string;
  tabindex?: number;
  hidden?: boolean;
  role?: string;
  draggable?: boolean;
  [attr: string]: unknown;
};

// ---------------------------------------------------------------------------
// html(tag) factory — creates a primitive for any HTML element
// ---------------------------------------------------------------------------

const $htmlTag: unique symbol = Symbol("htmlTag");
const tagCache = new Map<string, PrimitiveComponent<HtmlAttrs, ContainerEvents>>();

export function getHtmlTag(
  viewFn: ViewFn<Wildcard, Wildcard>,
): string | undefined {
  return (viewFn as Wildcard)[$htmlTag];
}

export function html<
  Attrs extends HtmlAttrs = HtmlAttrs,
  Events = ContainerEvents,
>(tag: string): PrimitiveComponent<Attrs, Events> {
  const cached = tagCache.get(tag);
  if (cached) return cached as unknown as PrimitiveComponent<Attrs, Events>;
  const p = primitive<Attrs, Events>();
  (p.viewFn as Wildcard)[$htmlTag] = tag;
  tagCache.set(tag, p as unknown as PrimitiveComponent<HtmlAttrs, ContainerEvents>);
  return p;
}

// ---------------------------------------------------------------------------
// Text node (special — not an HTMLElement)
// ---------------------------------------------------------------------------

const textPrimitive = primitive<{ content: string }>();

export function text(value: string | number): void {
  textPrimitive({ content: String(value) });
}
text.viewFn = textPrimitive.viewFn;

// ---------------------------------------------------------------------------
// Layout / structural
// ---------------------------------------------------------------------------

export const div = html("div");
export const span = html("span");
export const section = html("section");
export const article = html("article");
export const aside = html("aside");
export const nav = html("nav");
export const header = html("header");
export const footer = html("footer");
export const main = html("main");

// ---------------------------------------------------------------------------
// Text / inline
// ---------------------------------------------------------------------------

export const p = html("p");
export const h1 = html("h1");
export const h2 = html("h2");
export const h3 = html("h3");
export const h4 = html("h4");
export const h5 = html("h5");
export const h6 = html("h6");
export const pre = html("pre");
export const code = html("code");
export const em = html("em");
export const strong = html("strong");
export const small = html("small");
export const br = html("br");
export const hr = html("hr");
export const a = html<
  HtmlAttrs & { href?: string; target?: string },
  ContainerEvents
>("a");
export const blockquote = html("blockquote");
export const label = html<HtmlAttrs & { for?: string }, ContainerEvents>(
  "label",
);

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export const ul = html("ul");
export const ol = html("ol");
export const li = html("li");

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const table = html("table");
export const thead = html("thead");
export const tbody = html("tbody");
export const tfoot = html("tfoot");
export const tr = html("tr");
export const th = html<
  HtmlAttrs & { colspan?: number; rowspan?: number; scope?: string },
  ContainerEvents
>("th");
export const td = html<
  HtmlAttrs & { colspan?: number; rowspan?: number },
  ContainerEvents
>("td");

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export const form = html<
  HtmlAttrs & { action?: string; method?: string },
  ContainerEvents
>("form");

export const button = html<
  HtmlAttrs & { disabled?: boolean; type?: string },
  ContainerEvents
>("button");

export const input = html<
  HtmlAttrs & {
    type?: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    checked?: boolean;
    readOnly?: boolean;
    name?: string;
    min?: string;
    max?: string;
    step?: string;
    pattern?: string;
    required?: boolean;
    autofocus?: boolean;
  },
  FormEvents
>("input");

export const textarea = html<
  HtmlAttrs & {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    rows?: number;
    cols?: number;
    name?: string;
    required?: boolean;
  },
  FormEvents
>("textarea");

export const select = html<
  HtmlAttrs & {
    value?: string;
    disabled?: boolean;
    name?: string;
    multiple?: boolean;
    required?: boolean;
  },
  FormEvents
>("select");

export const option = html<
  HtmlAttrs & { value?: string; selected?: boolean; disabled?: boolean },
  ContainerEvents
>("option");

export const fieldset = html<
  HtmlAttrs & { disabled?: boolean },
  ContainerEvents
>("fieldset");
export const legend = html("legend");

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const img = html<
  HtmlAttrs & { src: string; alt?: string; width?: number; height?: number },
  ContainerEvents
>("img");

export const video = html<
  HtmlAttrs & {
    src?: string;
    controls?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    width?: number;
    height?: number;
  },
  ContainerEvents
>("video");

export const audio = html<
  HtmlAttrs & {
    src?: string;
    controls?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
  },
  ContainerEvents
>("audio");

export const canvas = html<
  HtmlAttrs & { width?: number; height?: number },
  ContainerEvents
>("canvas");

export const source = html<
  HtmlAttrs & { src?: string; type?: string },
  ContainerEvents
>("source");

// ---------------------------------------------------------------------------
// Other
// ---------------------------------------------------------------------------

export const details = html<HtmlAttrs & { open?: boolean }, ContainerEvents>(
  "details",
);
export const summary = html("summary");
export const dialog = html<HtmlAttrs & { open?: boolean }, ContainerEvents>(
  "dialog",
);
export const iframe = html<
  HtmlAttrs & {
    src?: string;
    width?: number;
    height?: number;
    sandbox?: string;
  },
  ContainerEvents
>("iframe");
