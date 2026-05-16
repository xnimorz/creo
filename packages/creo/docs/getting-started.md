# Getting Started

## Installation

<div class="pkg-tabs" data-pkg-tabs>
  <div class="pkg-tabs-bar" role="tablist">
    <button class="pkg-tab active" data-pkg="bun" role="tab">bun</button>
    <button class="pkg-tab" data-pkg="npm" role="tab">npm</button>
    <button class="pkg-tab" data-pkg="pnpm" role="tab">pnpm</button>
    <button class="pkg-tab" data-pkg="yarn" role="tab">yarn</button>
  </div>
  <pre class="pkg-panel active" data-pkg="bun"><code>bun add creo</code></pre>
  <pre class="pkg-panel" data-pkg="npm"><code>npm install creo</code></pre>
  <pre class="pkg-panel" data-pkg="pnpm"><code>pnpm add creo</code></pre>
  <pre class="pkg-panel" data-pkg="yarn"><code>yarn add creo</code></pre>
</div>

Creo is a pure JavaScript/TypeScript package with no runtime dependencies. It ships typed for TypeScript 5+, but works just as well from plain JavaScript.

## Your first component

Components are created with `view()`. The function receives a **context object** (here named `ctx`) and returns a `ViewBody` — an object containing at minimum a `render()` function and, optionally, lifecycle hooks (`onMount`, `onUpdateAfter`, etc.).

The context is how your component reads inputs and creates state. It has three members:

- **`ctx.props()`** — a function that returns the current props. Always call it (don't destructure) so you read the latest values on every render.
- **`ctx.use(initial)`** — creates reactive local state, or subscribes to a global `store`. Must be called in the view body, not inside `render()`.
- **`ctx.slot`** — the children the parent passed in. Call it (`ctx.slot?.()`) to render them.

Most code destructures what it needs: `({ props, use, slot }) => ...`.

Create `src/app.ts` with a greeting component:

```ts
// src/app.ts
import { view, div } from "creo";

export const Greeting = view<{ name: string }>(({ props }) => {
  return {
    render() {
      div({ class: "greeting" }, `Hello, ${props().name}!`);
    },
  };
});
```

When a primitive has a single string child, pass it as the slot directly — the engine wraps it as a text node automatically. No `text()` wrapper, no `() => {}` callback. Use a function slot only when you have multiple children or need structure.

This is a leaf component. Any component can compose others — the one you mount is called the **root**. Let's wrap `Greeting` in a root `App`:

```ts
// src/app.ts (continued)
export const App = view(() => {
  return {
    render() {
      Greeting({ name: "World" });
    },
  };
});
```

## Mounting the app

Now we have an `App` component — time to put it on the page. Every Creo app starts with `createApp`:

```ts
// src/main.ts
import { createApp, HtmlRender } from "creo";
import { App } from "./app";

const el = document.getElementById("app")!;  // <div id="app"></div> in index.html
createApp(() => App(), new HtmlRender(el)).mount();
```

`createApp` takes three arguments:

1. **A slot callback** (`() => void`) — you call your root component inside it, the same way you'd call a child component in any other render function.
2. **A renderer** — `HtmlRender` draws to the DOM. Other renderers produce JSON or HTML strings; see [Renderers](#/renderers).
3. **An optional options object** — for advanced settings like a custom scheduler (below).

Calling `.mount()` performs the first render. From then on, Creo re-renders automatically whenever reactive state used by the view changes.

> **Tip.** If you don't want to wire this up by hand, [`creo-create-app`](#/create-app) scaffolds exactly this file layout with Vite already configured.

### Custom scheduler

By default, Creo schedules re-renders via `queueMicrotask`. You can provide a custom scheduler. For example, `requestAnimationFrame` for visual updates:

```ts
createApp(
  () => App(),
  new HtmlRender(document.getElementById("app")!),
  { scheduler: requestAnimationFrame },
).mount();
```

The scheduler receives a `() => void` callback and is responsible for calling it when the next render should happen.

## Adding state

Use `ctx.use` to create reactive values. Here's a counter that displays the current value and a button to increment it:

```ts
import { view, div, button, _ } from "creo";

const Counter = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update(n => n + 1);

  return {
    render() {
      div(_, () => {
        div(_, String(count.get()));
        button({ on: { click: increment } }, "+1");
      });
    },
  };
});
```

Notice the two slot forms in play:

- The **outer `div`** has two children (the value and the button). Multiple children means a **function slot** — `() => { ... }` — where each primitive call adds a child to the parent.
- The **inner `div`** and the **`button`** each have just one string child, so they use the **string slot** form: `div(_, "...")`, `button({ on: { click } }, "+1")`. No `text()` call, no function wrapper.

As a rule: reach for a function slot when you need to render more than one thing or use control flow (`if`, `for`); use a string slot whenever a single piece of text is enough.

`use()` calls must appear in the body of the view function (before `return`), never inside `render()`. Call order must be stable across re-renders (same rule as React hooks).

## Composing components

Components accept an optional slot (children) as a second argument. The caller passes a string or `() => void`, and inside the view you receive it as `ctx.slot`:

```ts
import { view, div, p, text, _ } from "creo";

const Card = view(({ slot }) => {
  return {
    render() {
      div({ class: "card" }, slot);
    },
  };
});

// Usage in a parent render:
Card(_, () => {
  p(_, "Card content");
});
```

When a component does not need children, omit the second argument:

```ts
Counter({ initial: 0 });
```

## Full example

```ts
import { createApp, view, div, h1, ul, li, input, button, HtmlRender, _ } from "creo";
import type { InputEventData } from "creo";

const TodoApp = view(({ use }) => {
  const items = use<string[]>([]);
  const draft = use("");

  const handleInput = (e: InputEventData) => draft.set(e.value);
  const addItem = () => {
    if (draft.get().trim()) {
      items.update(list => [...list, draft.get().trim()]);
      draft.set("");
    }
  };

  return {
    render() {
      div({ class: "todo-app" }, () => {
        h1(_, "Todo");
        div(_, () => {
          input({
            value: draft.get(),
            placeholder: "New item...",
            on: { input: handleInput },
          });
          button({ on: { click: addItem } }, "Add");
        });
        ul(_, () => {
          for (const item of items.get()) {
            li({ key: item }, item);
          }
        });
      });
    },
  };
});

createApp(
  () => TodoApp(),
  new HtmlRender(document.getElementById("app")!),
).mount();
```
