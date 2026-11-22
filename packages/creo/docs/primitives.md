# Primitives

Primitives are the leaf-level building blocks in Creo. They correspond to HTML elements and are called as functions inside `render()`.

## Built-in HTML elements

Creo exports pre-defined primitives for all standard HTML elements. Import them directly:

```ts
import { div, span, p, h1, button, input, text, _ } from "creo";
```

### Calling primitives

Primitives accept two optional arguments:

1. **Props** -- an object with HTML attributes, plus event handlers under `on: { ... }`. Pass `_` when there are none.
2. **Slot** -- a `() => void` callback for child content, or a string (shorthand for `() => text("...")`).

```ts
// No props, no children
br();
hr();

// Props only
input({ type: "text", placeholder: "Enter name" });
img({ src: "/logo.png", alt: "Logo" });

// Props and children
div({ class: "card", id: "main" }, () => {
  h1(_, "Title");
  p(_, "Content goes here.");
});

// Children only (pass _ for props)
div(_, () => {
  text("Hello");
});

// Props and event handlers
button({ class: "btn", on: { click: handleClick } }, "Save");
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

### Demarcating edits

`del`, `ins` (with `cite`, `datetime`)

### Lists

`ul`, `ol`, `li`, `dl`, `dt`, `dd`

### Tables

`table`, `thead`, `tbody`, `tfoot`, `tr`, `th` (with `colspan`, `rowspan`, `scope`), `td` (with `colspan`, `rowspan`), `caption`, `colgroup`, `col`

### Forms

`form`, `button`, `input`, `textarea`, `select`, `option`, `fieldset`, `legend`, `datalist`, `optgroup`, `output`, `progress`, `meter`

Form elements like `input`, `textarea`, and `select` support `FormEvents` (includes `input`, `change`, `invalid`). `<form>` supports `FormSubmitEvents` (adds `submit`, `reset`). `video` / `audio` use `MediaEvents`, `details` / `dialog` use `DisclosureEvents` (adds `toggle`, `beforeToggle`). Other elements use `ContainerEvents`.

`<button>` also accepts the Invoker Commands and Popover API attributes:

- `commandfor` — id of the element to invoke
- `command` — the command to dispatch (built-in: `show-modal`, `close`, `request-close`, `show-popover`, `hide-popover`, `toggle-popover`; custom commands start with `--`)
- `popovertarget` — id of a popover element
- `popovertargetaction` — `"show"`, `"hide"`, or `"toggle"`

The receiving element handles a `command` event (`CommandEventData`) via the standard `on:` system. See [Events](#/events#invoker-commands-command-commandfor) for an example.

### Media

`img`, `video`, `audio`, `canvas`, `source`, `track`, `map`, `area`, `picture`

### Embedded

`iframe`, `embed`, `object`, `portal`, `svg`

### Interactive

`details` (with `open`), `summary`, `dialog` (with `open`), `menu`

### Figure

`figure`, `figcaption`

### Scripting

`script`, `noscript`, `template`, `slot` (the HTML `<slot>` element -- not the view `slot` callback)

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
  popover?: string;  // Popover API: "auto" | "manual" | "hint"
  ref?: Ref<Element>;  // DOM element after mount, null after unmount
  [attr: string]: unknown;  // open index signature for any HTML attribute
};
```

The open index signature means you can pass any attribute -- Creo will set it via `setAttribute`. Event handlers are not attributes: a flat `onClick` prop still typechecks but ends up as a dead string attribute. Put handlers under `on: { click }`.

## The html() factory

`html(tag)` creates a primitive for any tag at runtime. All built-in primitives are created this way:

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

`html()` does not cache -- each call creates a new primitive, so define them once at module level.

The tag string is all a renderer sees (via `view.viewFn[$primitive]`), so a custom renderer can give non-HTML tags whatever meaning it likes. See [Renderers](#/renderers) for details.

## Passing children

Primitives accept children in two forms:

### Slot callback

A `() => void` function called at the call site. The engine collects child calls made inside it:

```ts
div({ class: "wrapper" }, () => {
  p(_, "Hello");
  span(_, "World");
});
```

### String slot

A string renders as a single text node:

```ts
li(_, "Item text");
span({ class: "label" }, `Hello, ${name}`);
```

### Slot passthrough

A view can forward the `slot` it received from its parent straight to a primitive:

```ts
const Card = view(({ slot }) => ({
  render() {
    div({ class: "card" }, slot);
  },
}));
```
