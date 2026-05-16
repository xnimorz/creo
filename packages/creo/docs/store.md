# Store

Creo's store system provides globally visible reactive data. A store is created outside views and can be read/written from any view via `use()`.

## Creating a store

Use `store.new(initial)` at module scope:

```ts
import { store } from "creo";

const ThemeStore = store.new<"light" | "dark">("light");
const UserStore = store.new<{ name: string; role: string } | null>(null);
```

Store instances are typically defined at module scope and imported where needed.

## Reading from a view

Use `use(store)` inside a view function to subscribe and get a reactive accessor:

```ts
import { view, div, text } from "creo";

const ThemedButton = view(({ use }) => {
  const theme = use(ThemeStore); // re-renders when ThemeStore changes

  return {
    render() {
      button({ class: theme.get() === "dark" ? "btn-dark" : "btn-light" }, () => {
        text("Click me");
      });
    },
  };
});
```

`use(store)` subscribes the view to changes. When the store value is updated via `.set()` or `.update()`, all subscribed views are scheduled for re-render. Subscriptions are automatically cleaned up when the view is disposed.

## Setting values

Call `.set()` or `.update()` on the store directly -- from anywhere, including outside views:

```ts
// From a handler
const toggle = () => {
  const current = ThemeStore.get();
  ThemeStore.set(current === "light" ? "dark" : "light");
};

// From outside any view
ThemeStore.set("dark");

// Using update
ThemeStore.update(current => current === "light" ? "dark" : "light");
```

## Complete example

```ts
import { createApp, store, view, div, button, span, text, HtmlRender } from "creo";

// 1. Create the store
const CounterStore = store.new(0);

// 2. Writer component
const IncrementButton = view(({ use }) => {
  const counter = use(CounterStore);
  const increment = () => counter.update(n => n + 1);

  return {
    render() {
      button({ on: { click: increment } }, () => { text("+1"); });
    },
  };
});

// 3. Reader component
const DisplayCount = view(({ use }) => {
  const counter = use(CounterStore);

  return {
    render() {
      span({}, () => {
        text(`Count: ${counter.get()}`);
      });
    },
  };
});

// 4. App
const App = view(() => ({
  render() {
    div({}, () => {
      IncrementButton();
      DisplayCount();
    });
  },
}));

// 5. Mount
createApp(() => App(), new HtmlRender(document.getElementById("app")!)).mount();
```

## Store vs State

Both store and local state use the same `use()` function and return the same `Reactive<T>` interface (`get`, `set`, `update`). The difference:

| | Store | State |
|---|---|---|
| Created with | `store.new(initial)` | `use(initial)` inside a view |
| Scope | Global -- shared across views | Local -- private to the view |
| Setting from outside | `MyStore.set(value)` | Not possible |
| Subscribes view | Yes -- `use(store)` re-renders on change | Yes -- `use(value)` re-renders on change |

## Store type

The `Store<T>` class is exported for type annotations:

```ts
import type { Store } from "creo";

function resetStore<T>(s: Store<T>, value: T): void {
  s.set(value);
}
```

### Full API

| Method | Description |
|--------|-------------|
| `.get(): T` | Read the current value |
| `.set(value: T): void` | Set a new value, re-render all subscribers |
| `.update(fn: (current: T) => T): void` | Apply a sync transform, re-render subscribers |
| `.update(fn: (current: T) => Promise<T>): void` | Apply an async transform, re-render on resolve |
