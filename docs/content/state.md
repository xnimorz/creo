# State

Creo's state system provides reactive values that trigger re-renders when changed.

## Creating state

Call `use(initial)` in the view function body (before `return`):

```ts
import { view, text } from "creo";

const Counter = view(({ use }) => {
  const count = use(0);
  const name = use("untitled");
  const items = use<string[]>([]);

  return {
    render() {
      text(String(count.get()));
    },
  };
});
```

### Rules

- Call `use()` **before** returning the ViewBody, never inside `render()`.
- Call order must be stable across re-renders (same as React hooks). Do not call `use()` inside conditionals or loops.
- On the first render, `use(initial)` creates a new `Reactive<T>` instance. On subsequent renders, it returns the existing instance at the same position (the `initial` argument is ignored).

## Reading state

Use `.get()` to read the current value:

```ts
const count = use(0);

return {
  render() {
    text(String(count.get())); // reads current value
  },
};
```

`.get()` always returns the latest committed value, including any changes made by `.set()` or `.update()` earlier in the same cycle.

## Setting state

### .set(value)

Replace the current value and schedule a re-render:

```ts
const name = use("Alice");

const rename = () => name.set("Bob");
```

`.set()` applies the value **immediately** -- calling `.get()` right after `.set()` returns the new value. A re-render is then scheduled through the engine's scheduler.

### .update(fn)

Apply a function to the current value:

```ts
const count = use(0);

const increment = () => count.update(n => n + 1);
const decrement = () => count.update(n => n - 1);
```

Like `.set()`, the update is applied immediately and a re-render is scheduled.

### Async updates

`.update()` also accepts async functions. The value is applied and render is scheduled when the promise resolves:

```ts
const data = use<string[]>([]);

const fetchData = () => data.update(async current => {
  const response = await fetch("/api/items");
  const items = await response.json();
  return items;
});
```

## State vs plain variables

Use `use()` for values that should trigger re-renders when they change. For ephemeral values that do not affect the rendered output, a plain `let` variable is sufficient:

```ts
const MyComponent = view(({ use }) => {
  const count = use(0);        // reactive -- triggers re-render on change
  let lastClickTime = 0;       // not reactive -- no re-render needed

  const handleClick = () => {
    lastClickTime = Date.now();
    count.update(n => n + 1);
  };

  return {
    render() {
      button({ onClick: handleClick }, () => {
        text(String(count.get()));
      });
    },
  };
});
```

## The Reactive interface

Both `use(initial)` (local state) and `use(store)` (store binding) return `Reactive<T>`:

```ts
import type { Reactive } from "creo";

function doubleReactive(r: Reactive<number>): void {
  r.update(n => n * 2);
}
```

### Full API

| Method | Description |
|--------|-------------|
| `.get(): T` | Read the current value |
| `.set(value: T): void` | Set a new value immediately, schedule re-render |
| `.update(fn: (current: T) => T): void` | Apply a sync transform, schedule re-render |
| `.update(fn: (current: T) => Promise<T>): void` | Apply an async transform, schedule re-render on resolve |
