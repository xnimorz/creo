# Primitives

Primitives are the leaf-level building blocks in Creo. They correspond to HTML elements and are called as functions inside `render()`.

## Built-in HTML elements

Creo exports pre-defined primitives for all standard HTML elements. Import them directly:

```ts
import { div, span, p, h1, button, input, text } from "creo";
```

### Calling primitives

Primitives accept two optional arguments:

1. **Props** -- an object with HTML attributes and event handlers.
2. **Slot** -- a `() => void` callback for child content, or a `PendingView[]` for passthrough children.

```ts
// No props, no children
br();
hr();

// Props only
input({ type: "text", placeholder: "Enter name" });
img({ src: "/logo.png", alt: "Logo" });

// Props and children
div({ class: "card", id: "main" }, () => {
  h1({}, () => { text("Title"); });
  p({}, () => { text("Content goes here."); });
});

// Children only (pass undefined or omit props)
div({}, () => {
  text("Hello");
});
```

### text()

`text()` renders a text node. It accepts a string or number:

```ts
text("Hello, world");
text(42);
text(count.get());
```

`text()` does not accept children.

## Available elements

### Layout / structural

`div`, `span`, `section`, `article`, `aside`, `nav`, `header`, `footer`, `main`

### Sectioning

`address`, `hgroup`, `search`

### Text / headings

`p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `pre`, `code`, `em`, `strong`, `small`, `br`, `hr`, `blockquote`

### Links and labels

`a` (with `href`, `target` attrs), `label` (with `for` attr)

### Text semantics

`abbr`, `b`, `bdi`, `bdo`, `cite`, `data`, `dfn`, `i`, `kbd`, `mark`, `q`, `rp`, `rt`, `ruby`, `s`, `samp`, `sub`, `sup`, `time`, `u`, `varEl`, `wbr`

### Lists

`ul`, `ol`, `li`, `dl`, `dt`, `dd`

### Tables

`table`, `thead`, `tbody`, `tfoot`, `tr`, `th` (with `colspan`, `rowspan`, `scope`), `td` (with `colspan`, `rowspan`), `caption`, `colgroup`, `col`

### Forms

`form`, `button`, `input`, `textarea`, `select`, `option`, `fieldset`, `legend`, `datalist`, `optgroup`, `output`, `progress`, `meter`

Form elements like `input`, `textarea`, and `select` support `FormEvents` (includes `onInput`, `onChange`). Other elements use `ContainerEvents`.

### Media

`img`, `video`, `audio`, `canvas`, `source`, `track`, `map`, `area`, `picture`

### Embedded

`iframe`, `embed`, `object`, `portal`, `svg`

### Interactive

`details` (with `open`), `summary`, `dialog` (with `open`), `menu`

### Figure

`figure`, `figcaption`

## HtmlAttrs

All built-in primitives share a common attribute base:

```ts
type HtmlAttrs = {
  class?: string;
  id?: string;
  style?: string;
  title?: string;
  tabindex?: number;
  hidden?: boolean;
  role?: string;
  draggable?: boolean;
  [attr: string]: unknown;  // open index signature for any HTML attribute
};
```

The open index signature means you can pass any attribute -- Creo will set it via `setAttribute`.

## The html() factory

`html(tag)` creates a primitive for any HTML tag at runtime. All built-in primitives are created this way:

```ts
import { html } from "creo";

// Create a custom element primitive
const myWidget = html("my-widget");

// Use it in render
myWidget({ class: "fancy" }, () => {
  text("Inside custom element");
});
```

You can specify custom attribute and event types via generics:

```ts
const video = html<
  HtmlAttrs & { src?: string; controls?: boolean; autoplay?: boolean },
  ContainerEvents
>("video");
```

`html()` caches primitives by tag name -- calling `html("div")` twice returns the same primitive.

## The primitive() factory

For completely custom primitives (not backed by an HTML tag), use `primitive()`:

```ts
import { primitive } from "creo";
import type { PrimitiveComponent } from "creo";

type CanvasAttrs = { width: number; height: number };
type CanvasEvents = { click: (e: PointerEventData) => void };

const myCanvas: PrimitiveComponent<CanvasAttrs, CanvasEvents> = primitive<CanvasAttrs, CanvasEvents>();
```

Custom primitives need a render handler registered on the renderer to produce output. See [Renderers](./renderers.md) for details.

## Passing children

Primitives accept children in two forms:

### Slot callback

A `() => void` function called at the call site. The engine collects child calls made inside it:

```ts
div({ class: "wrapper" }, () => {
  p({}, () => { text("Hello"); });
  span({}, () => { text("World"); });
});
```

### PendingView array (passthrough)

When a view receives `ctx.children` from its parent, it can pass that array directly as the second argument:

```ts
const Card = view((ctx) => ({
  render() {
    div({ class: "card" }, ctx.children);
  },
}));
```

This avoids re-collecting children and preserves the parent's pending views directly.
