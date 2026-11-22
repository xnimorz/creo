# Creo UI Framework

Creo is a lightweight, imperative UI framework for building reactive interfaces in TypeScript.

## What is Creo?

Creo takes a different approach from JSX-based frameworks. Instead of describing UI as a tree of elements returned from render functions, Creo uses **imperative render streams** -- you call primitives as functions, and the framework builds the virtual DOM from those calls.

```ts
import { view, div, h1, p, _ } from "creo";

const App = view(() => {
  return {
    render() {
      div({ class: "app" }, () => {
        h1(_, "Hello, Creo");
        p(_, "An imperative UI framework.");
      });
    },
  };
});
```

## Why Creo?

- **No JSX, no compiler.** Render functions are plain TypeScript. All control flow (if/else, for loops, ternaries) works naturally.
- **Immediate state.** Calling `.set()` or `.update()` applies the value instantly. No stale closures, no batching surprises.
- **Explicit lifecycle.** Named hooks (`onMount`, `shouldUpdate`, `onUpdateBefore`, `onUpdateAfter`, `dispose`) replace dependency-array guessing.
- **Renderer-agnostic.** The same component tree can target the DOM (`HtmlRender`), a JSON structure (`JsonRender`), or an HTML string (`HtmlStringRender`). Write your own renderer by implementing the `IRender` interface.
- **Lightweight.** No virtual DOM diffing library, no template compiler. Reconciliation is built into the engine with keyed and positional matching.

## Quick taste

```ts
import { createApp, view, div, button, text, HtmlRender, _ } from "creo";

const Counter = view<{ initial: number }>(({ props, use }) => {
  const count = use(props().initial);
  const increment = () => count.update(n => n + 1);

  return {
    render() {
      div(_, () => {
        text(count.get());
        button({ on: { click: increment } }, "+1");
      });
    },
  };
});

createApp(
  () => Counter({ initial: 0 }),
  new HtmlRender(document.getElementById("app")!),
).mount();
```

## Documentation

- [Getting Started](#/getting-started) -- installation, first app
- [view()](#/view) -- defining components
- [State](#/state) -- reactive state management
- [Events](#/events) -- handling user interactions
- [Primitives](#/primitives) -- built-in HTML elements and custom primitives
- [Store](#/store) -- global/shared state (context pattern)
- [Renderers](#/renderers) -- HtmlRender, JsonRender, HtmlStringRender, custom renderers
- [Lifecycle](#/lifecycle) -- mount, update, and disposal hooks
