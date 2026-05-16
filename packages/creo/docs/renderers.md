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
- Event listener binding and cleanup
- DOM properties (`value`, `checked`, `selected`) set directly instead of via `setAttribute`
- Keyed reordering of child nodes
- Boolean attribute handling (`disabled`, `hidden`, etc.)
- `autofocus` support on mount

### JsonRender

Produces a JSON tree representation of the UI. Useful for testing and serialization.

```ts
import { createApp, JsonRender } from "creo";
import type { JsonNode } from "creo";

const renderer = new JsonRender();
createApp(() => App(), renderer).mount();

const tree: JsonNode | undefined = renderer.root;
// {
//   type: "div",
//   props: { class: "app" },
//   children: [ ... ],
//   key: undefined
// }
```

The `JsonNode` type:

```ts
type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[];
  key?: string | number;
};
```

### StringRender

Produces an HTML string from the virtual DOM. Useful for server-side rendering.

```ts
import { createApp, StringRender } from "creo";

const renderer = new StringRender();
createApp(() => App(), renderer).mount();

const html: string = renderer.renderToString();
// "<div><h1>Hello</h1><p>World</p></div>"
```

`StringRender` is pull-based -- `render()` and `unmount()` are essentially no-ops. Call `renderToString()` to walk the virtual DOM and build the HTML string on demand.

## The IRender interface

All renderers implement `IRender<Output>`:

```ts
interface IRender<Output> {
  /** Create output if view is new, or update if existing. */
  render(view: BaseView): void;

  /** Remove a view's output artifacts. Called on disposal. */
  unmount(view: BaseView): void;

  /** Register render handlers for custom primitive components. */
  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<Output>][],
  ): void;
}
```

The `Output` type parameter describes what each primitive produces (e.g., `HTMLElement | Text` for HtmlRender, `JsonNode` for JsonRender, `string` for StringRender).

## Custom renderers

To create a custom renderer, implement `IRender<YourOutput>`:

```ts
import type { IRender, PrimitiveRenderHandler } from "creo";
import type { PrimitiveComponent } from "creo";
import type { BaseView } from "creo"; // available via internal types

class CanvasRender implements IRender<void> {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  render(view: BaseView): void {
    // Draw or update based on view.props, view.renderRef, etc.
  }

  unmount(view: BaseView): void {
    // Clean up any resources
    view.renderRef = undefined;
  }

  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<void>][],
  ): void {
    // Store handlers for custom primitives
  }
}
```

## Registering custom primitives

When you create a primitive with `primitive()` (not `html()`), you must register a render handler on the renderer so it knows how to produce output:

```ts
import { primitive, createApp, HtmlRender } from "creo";

// Define a custom primitive
const sparkline = primitive<{ data: number[]; width: number; height: number }>();

// Create renderer and register the handler
const renderer = new HtmlRender(document.getElementById("app")!);
renderer.registerPrimitive([
  [sparkline, {
    render(view) {
      const canvas = document.createElement("canvas");
      canvas.width = view.props.width;
      canvas.height = view.props.height;
      // draw sparkline on canvas...
      return canvas;
    },
  }],
]);

// Now sparkline() can be used in render functions
createApp(() => App(), renderer).mount();
```

The `PrimitiveRenderHandler<Output>` interface:

```ts
interface PrimitiveRenderHandler<Output> {
  render(view: BaseView): Output;
}
```

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
