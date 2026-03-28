# Getting Started

## Installation

```bash
npm install creo
# or
bun add creo
```

Creo is a pure TypeScript package with no runtime dependencies. It requires TypeScript 5+.

## Creating an application

Every Creo app starts with `createApp`. It takes three arguments:

1. A **slot callback** that calls your root component.
2. A **renderer** that knows how to turn the virtual DOM into output (DOM nodes, JSON, HTML string, etc.).
3. An optional **options** object.

```ts
import { createApp, HtmlRender } from "creo";

const el = document.getElementById("app")!;
createApp(() => App(), new HtmlRender(el)).mount();
```

The slot callback is `() => void` -- you call your root component inside it, just like you would call a child component inside any render function.

### Custom scheduler

By default, Creo schedules re-renders via `queueMicrotask`. You can provide a custom scheduler -- for example, `requestAnimationFrame` for visual updates:

```ts
createApp(
  () => App(),
  new HtmlRender(document.getElementById("app")!),
  { scheduler: requestAnimationFrame },
).mount();
```

The scheduler receives a `() => void` callback and is responsible for calling it when the next render should happen.

## Your first component

Components are created with `view()`. The function receives a context object (`ctx`) and returns a `ViewBody` containing at minimum a `render()` function.

```ts
import { view, div, text } from "creo";

const Greeting = view<{ name: string }>((ctx) => {
  return {
    render() {
      div({ class: "greeting" }, () => {
        text(`Hello, ${ctx.props().name}!`);
      });
    },
  };
});
```

Call it from a parent's render:

```ts
const App = view((ctx) => {
  return {
    render() {
      Greeting({ name: "World" });
    },
  };
});
```

## Adding state

Use `ctx.use` to create reactive values:

```ts
import { view, div, button, text } from "creo";

const Counter = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update(n => n + 1);

  return {
    render() {
      div({}, () => {
        text(String(count.get()));
        button({ onClick: increment }, () => { text("+1"); });
      });
    },
  };
});
```

`use()` calls must appear in the body of the view function (before `return`), never inside `render()`. Call order must be stable across re-renders (same rule as React hooks).

## Composing components

Components accept an optional slot (children) as a second argument. The caller passes `() => void`, and inside the view `ctx.children` is a `PendingView[]`:

```ts
import { view, div } from "creo";

const Card = view((ctx) => {
  return {
    render() {
      div({ class: "card" }, ctx.children);
    },
  };
});

// Usage in a parent render:
Card({}, () => {
  p({}, () => { text("Card content"); });
});
```

When a component does not need children, omit the second argument:

```ts
Counter({ initial: 0 });
```

## Full example

```ts
import { createApp, view, div, h1, ul, li, input, button, text, HtmlRender } from "creo";
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
        h1({}, () => { text("Todo"); });
        div({}, () => {
          input({ value: draft.get(), onInput: handleInput, placeholder: "New item..." });
          button({ onClick: addItem }, () => { text("Add"); });
        });
        ul({}, () => {
          for (const item of items.get()) {
            li({}, () => { text(item); });
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
