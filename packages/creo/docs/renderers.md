# Renderers

Creo separates the component model from the output target. Renderers implement the `IRender` interface to translate the virtual DOM into a specific output format.

## Built-in renderers

### HtmlRender

Renders to the browser DOM. This is the primary renderer for web applications.

```ts
import { createApp, HtmlRender } from "creo";

const container = document.getElementById("app")!;
createApp(() => App(), new HtmlRender(container)).mount();
```

`HtmlRender` handles:
- Creating and updating DOM elements
- Attribute diffing (only changed attributes are touched)
- Event handling (`on: { ... }`) via delegated listeners on the container
- DOM properties (`value`, `checked`, `selected`, `indeterminate`, `muted`) set directly instead of via `setAttribute`
- Keyed reordering of child nodes
- Boolean attribute handling (`disabled`, `hidden`, etc.)
- `autofocus` support on mount

### JsonRender

Produces a JSON tree representation of the UI. Useful for testing and serialization.

```ts
import { createApp, JsonRender } from "creo";
import type { JsonNode, Maybe } from "creo";

const renderer = new JsonRender();
createApp(() => App(), renderer).mount();

const tree: Maybe<JsonNode> = renderer.root;
// {
//   type: "composite",   // the app root -- every composite view is a "composite" node
//   props: {},
//   children: [
//     { type: "composite", props: {}, children: [   // App()
//       { type: "div", props: { class: "app" }, children: [ ... ] },
//     ] },
//   ],
// }
```

Primitives use their tag as `type`; text nodes are `{ type: "text", props: { content } }`.

The `JsonNode` type:

```ts
type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[];
  key?: string | number;
};
```

### HtmlStringRender

Produces an HTML string from the virtual DOM. Useful for server-side rendering.

```ts
import { createApp, HtmlStringRender } from "creo";

const renderer = new HtmlStringRender();
createApp(() => App(), renderer).mount();

const html: string = renderer.renderToString();
// "<div><h1>Hello</h1><p>World</p></div>"
```

`HtmlStringRender` is pull-based -- `render()` and `unmount()` are essentially no-ops. Call `renderToString()` to walk the virtual DOM and build the HTML string on demand (composite views are transparent; the output matches `HtmlRender`'s `innerHTML`).

## The IRender interface

All renderers implement `IRender<Output>`:

```ts
interface IRender<Output> {
  /** Set by the Engine constructor. */
  engine: Engine;

  /** Create output if view has no renderRef, else update. */
  render(view: ViewRecord): void;

  /** Remove a view's output artifacts. Called on disposal. */
  unmount(view: ViewRecord): void;

  /**
   * Optional: beginMount(root) → render() pre-order, attach() post-order → endMount(root).
   * `anchor` undefined = compute; the returned anchor is reused for following siblings.
   */
  beginMount?(root: ViewRecord, anchor?: unknown): unknown;
  attach?(view: ViewRecord): void;
  endMount?(root: ViewRecord): void;

  /** Optional: live output drifted from shallow-equal props (e.g. user typed into an input). */
  shouldReassert?(view: ViewRecord, nextProps: unknown): boolean;
}
```

The `Output` type parameter describes what each primitive produces (e.g., `HTMLElement | Text` for HtmlRender, `JsonNode` for JsonRender, `string` for HtmlStringRender).

`render()` is called for every view, composite or primitive. Mounting a new subtree is depth-first: `render()` runs pre-order (parent before children) and `attach()` post-order, so a renderer can build a detached subtree and insert it once -- that is what `HtmlRender` does. Renderers that don't need this (`JsonRender`, `HtmlStringRender`) omit the optional hooks.

## Custom renderers

To create a custom renderer, implement `IRender<YourOutput>`:

```ts
import { $primitive } from "creo";
import type { IRender, Engine } from "creo";

// ViewRecord isn't exported; derive it from the interface
type ViewRecord = Parameters<IRender<unknown>["render"]>[0];

class CanvasRender implements IRender<void> {
  engine!: Engine;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  render(view: ViewRecord): void {
    const tag = view.viewFn[$primitive]; // undefined for composite views
    // Draw or update based on tag, view.props, view.renderRef, etc.
  }

  unmount(view: ViewRecord): void {
    // Clean up any resources
    view.renderRef = undefined;
  }
}
```

There is no primitive registry: the tag passed to `html(tag)` is the only thing a renderer sees, so custom "primitives" are just `html("sparkline")` with a renderer that branches on `view.viewFn[$primitive]`.

## Scheduler integration

The renderer is paired with a scheduler via `createApp` options. The scheduler controls when re-renders happen:

```ts
// Default: queueMicrotask (immediate, within same task)
createApp(() => App(), new HtmlRender(el)).mount();

// requestAnimationFrame (synced to display refresh)
createApp(() => App(), new HtmlRender(el), {
  scheduler: requestAnimationFrame,
}).mount();

// Custom scheduler
createApp(() => App(), new HtmlRender(el), {
  scheduler: (cb) => setTimeout(cb, 16),
}).mount();
```

The `Scheduler` type is `(callback: () => void) => void`.
