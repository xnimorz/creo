import type { Wildcard } from "@/internal/wildcard";
import { $primitive, type EventHandlerProps } from "../primitive";
import {
  view,
  type PublicView,
  type Slot,
  type ViewBody,
  type ViewFn,
} from "../view";
import { orchestrator } from "@/internal/orchestrator";

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

export function html<
  Attrs extends HtmlAttrs = HtmlAttrs,
  Events = ContainerEvents,
>(tag: string): PublicView<Attrs & EventHandlerProps<Events>, void> {
  const fn: ViewFn<Attrs & EventHandlerProps<Events>, void> = <Props>({
    slot,
  }: {
    slot: Slot;
  }): ViewBody<Props, void> => ({
    render() {
      slot();
    },
  });
  fn[$primitive] = tag;
  return view(fn);
}

// ---------------------------------------------------------------------------
// Text node — typed as (content: string | number) => void
// ---------------------------------------------------------------------------

const textViewFn: ViewFn<string | number, void> = Object.assign(
  (() => ({ render() {} })) as ViewFn<string | number, void>,
  { [$primitive]: "text" as string },
);

export function text(content: string | number): void {
  orchestrator.currentEngine()!.view(textViewFn, content, null, null);
}

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
// Interactive
// ---------------------------------------------------------------------------

export const details = html<HtmlAttrs & { open?: boolean }, ContainerEvents>(
  "details",
);
export const summary = html("summary");
export const dialog = html<HtmlAttrs & { open?: boolean }, ContainerEvents>(
  "dialog",
);
export const menu = html("menu");

// ---------------------------------------------------------------------------
// Embedded content
// ---------------------------------------------------------------------------

export const iframe = html<
  HtmlAttrs & {
    src?: string;
    width?: number;
    height?: number;
    sandbox?: string;
    allow?: string;
    loading?: string;
    referrerpolicy?: string;
  },
  ContainerEvents
>("iframe");
export const embed = html<
  HtmlAttrs & { src?: string; type?: string; width?: number; height?: number },
  ContainerEvents
>("embed");
export const object = html<
  HtmlAttrs & {
    data?: string;
    type?: string;
    width?: number;
    height?: number;
    name?: string;
  },
  ContainerEvents
>("object");
export const picture = html("picture");
export const portal = html<HtmlAttrs & { src?: string }, ContainerEvents>(
  "portal",
);

// ---------------------------------------------------------------------------
// SVG (container only — inner SVG elements use html() ad-hoc)
// ---------------------------------------------------------------------------

export const svg = html<
  HtmlAttrs & {
    viewBox?: string;
    xmlns?: string;
    width?: number | string;
    height?: number | string;
    fill?: string;
  },
  ContainerEvents
>("svg");

// ---------------------------------------------------------------------------
// Scripting / metadata (rarely used in render, but complete for parity)
// ---------------------------------------------------------------------------

export const script = html<
  HtmlAttrs & { src?: string; type?: string; async?: boolean; defer?: boolean },
  ContainerEvents
>("script");
export const noscript = html("noscript");
export const template = html("template");
export const slot = html<HtmlAttrs & { name?: string }, ContainerEvents>(
  "slot",
);

// ---------------------------------------------------------------------------
// Sectioning
// ---------------------------------------------------------------------------

export const address = html("address");
export const hgroup = html("hgroup");
export const search = html("search");

// ---------------------------------------------------------------------------
// Text semantics
// ---------------------------------------------------------------------------

export const abbr = html("abbr");
export const b = html("b");
export const bdi = html("bdi");
export const bdo = html<HtmlAttrs & { dir?: string }, ContainerEvents>("bdo");
export const cite = html("cite");
export const data = html<HtmlAttrs & { value?: string }, ContainerEvents>(
  "data",
);
export const dfn = html("dfn");
export const i = html("i");
export const kbd = html("kbd");
export const mark = html("mark");
export const q = html<HtmlAttrs & { cite?: string }, ContainerEvents>("q");
export const rp = html("rp");
export const rt = html("rt");
export const ruby = html("ruby");
export const s = html("s");
export const samp = html("samp");
export const sub = html("sub");
export const sup = html("sup");
export const time = html<HtmlAttrs & { datetime?: string }, ContainerEvents>(
  "time",
);
export const u = html("u");
export const varEl = html("var");
export const wbr = html("wbr");

// ---------------------------------------------------------------------------
// Demarcating edits
// ---------------------------------------------------------------------------

export const del = html<
  HtmlAttrs & { cite?: string; datetime?: string },
  ContainerEvents
>("del");
export const ins = html<
  HtmlAttrs & { cite?: string; datetime?: string },
  ContainerEvents
>("ins");

// ---------------------------------------------------------------------------
// Table (additional)
// ---------------------------------------------------------------------------

export const caption = html("caption");
export const colgroup = html<HtmlAttrs & { span?: number }, ContainerEvents>(
  "colgroup",
);
export const col = html<HtmlAttrs & { span?: number }, ContainerEvents>("col");

// ---------------------------------------------------------------------------
// Form (additional)
// ---------------------------------------------------------------------------

export const datalist = html("datalist");
export const optgroup = html<
  HtmlAttrs & { label?: string; disabled?: boolean },
  ContainerEvents
>("optgroup");
export const output = html<
  HtmlAttrs & { for?: string; name?: string },
  ContainerEvents
>("output");
export const progress = html<
  HtmlAttrs & { value?: number; max?: number },
  ContainerEvents
>("progress");
export const meter = html<
  HtmlAttrs & {
    value?: number;
    min?: number;
    max?: number;
    low?: number;
    high?: number;
    optimum?: number;
  },
  ContainerEvents
>("meter");

// ---------------------------------------------------------------------------
// Figure
// ---------------------------------------------------------------------------

export const figure = html("figure");
export const figcaption = html("figcaption");

// ---------------------------------------------------------------------------
// Line break opportunity / content
// ---------------------------------------------------------------------------

export const dd = html("dd");
export const dl = html("dl");
export const dt = html("dt");

// ---------------------------------------------------------------------------
// Media (additional)
// ---------------------------------------------------------------------------

export const track = html<
  HtmlAttrs & {
    src?: string;
    kind?: string;
    srclang?: string;
    label?: string;
    default?: boolean;
  },
  ContainerEvents
>("track");
export const map = html<HtmlAttrs & { name?: string }, ContainerEvents>("map");
export const area = html<
  HtmlAttrs & {
    alt?: string;
    coords?: string;
    href?: string;
    shape?: string;
    target?: string;
  },
  ContainerEvents
>("area");
