# Creo

> _"There is a point of no return"_

- A "streaming" UI framework.
- No JSX, no templates, no compiler — views are function calls that flow top-down, rendered as they execute.
- Simplicity over tons of features

## Philosophy

### Streaming the UI

Most frameworks build a tree and diff it. Creo streams it. When `render()` runs, each `div()`, `text()`, `span()` call immediately registers a child in sequence — there is no intermediate representation between your code and the virtual DOM. The render function IS the tree, read top to bottom. What you call is what you get, in the order you call it.

```ts
render() {
  h1({}, () => text("Title"));     // first child
  p({}, () => text("Paragraph"));  // second child
  ul({}, () => {                   // third child, with its own children streamed inside
    li({}, () => text("One"));
    li({}, () => text("Two"));
  });
}
```

### Native control flow

No `v-if`, no `{condition && <X/>}`, no `.map()` wrappers. Creo renders imperatively — use `if`, `for`, `while`, `switch`, or any JavaScript you want. The language IS the template language.

```ts
render() {
  if (loading.get()) {
    Spinner();
  } else if (error.get()) {
    ErrorBanner({ message: error.get() });
  } else {
    for (const item of items.get()) {
      ListItem({ key: item.id, data: item });
    }
  }
}
```

Say _NO_ to:

- special syntax to learn.
- framework-specific iteration helpers.
- ternary gymnastics.

### Minimal model

The entire reactivity model is three concepts:

- **`use(value)`** — local state. Call `.get()`, `.set()`, `.update()`. That's it.
- **`store.new(value)`** — global state. Same interface. Any view can subscribe with `use(store)`.
- **`props()`** — read-only, passed by parent. A function call, not a magic object.

No:

- Computed properties
- Watchers
- Dependency arrays
- Selectors

State is explicit: you set it, you read it, you control when things update via `shouldUpdate`.

One of major ideas under the framework "if user can do it with same efficiency, let it outside framework zone"

### Pluggable renderers

Creo allows any renderer overrides.

- **`HtmlRender`** — DOM output for browsers
- **`JsonRender`** — JSON AST for testing and serialization
- **`StringRender`** — HTML strings for SSR

```ts
// Browser
createApp(() => App(), new HtmlRender(document.getElementById("app")!)).mount();

// Server
const renderer = new StringRender();
const engine = new Engine(renderer);
engine.createRoot(() => App(), {});
engine.render();
return renderer.renderToString();
```

## Quick Start

```ts
import { createApp, view, div, text, button } from "creo";
import { HtmlRender } from "creo";

const Counter = view<{ initial: number }>(({ props, use }) => {
  const count = use(props().initial);
  const increment = () => count.update((n) => n + 1);

  return {
    render() {
      button({ onClick: increment }, () => {
        text(count.get());
      });
    },
  };
});

createApp(
  () => Counter({ initial: 0 }),
  new HtmlRender(document.getElementById("app")!),
).mount();
```

## Core Concepts

### Views

Views are components. Define them with `view<Props>()`, which takes a setup function called once per lifecycle. The setup returns a `ViewBody` with a `render()` function called on every update.

```ts
const Greeting = view<{ name: string }>(({ props }) => ({
  render() {
    div({ class: "greeting" }, () => {
      text(`Hello, ${props().name}!`);
    });
  },
}));

// Usage in another view's render:
Greeting({ name: "world" });
```

### State

Local reactive state via `use()`. Called once in the setup function, read via `.get()` in render.

```ts
const Toggle = view(({ use }) => {
  const on = use(false);
  const toggle = () => on.update((v) => !v);

  return {
    render() {
      button({ onClick: toggle }, () => {
        text(on.get() ? "ON" : "OFF");
      });
    },
  };
});
```

### Store

Global shared state. Create outside views, subscribe inside with `use(store)`.

```ts
import { store } from "creo";

const ThemeStore = store.new<"light" | "dark">("light");

// Any view can subscribe:
const ThemeDisplay = view(({ use }) => {
  const theme = use(ThemeStore);
  return {
    render() {
      text(`Theme: ${theme.get()}`);
    },
  };
});

// Update from anywhere:
ThemeStore.set("dark");
```

### Slots (Children)

Pass children via a slot callback — the second argument to any view or primitive.

```ts
const Card = view<{ title: string }>(({ props, slot }) => ({
  render() {
    div({ class: "card" }, () => {
      h1({}, () => text(props().title));
      div({ class: "card-body" }, slot);
    });
  },
}));

// Usage:
Card({ title: "Hello" }, () => {
  p({}, () => text("Card content here."));
});
```

### Lifecycle Hooks

```ts
const MyView = view<{ value: number }>(({ props }) => ({
  onMount() {
    /* after first render */
  },
  onUpdateBefore() {
    /* before re-render */
  },
  onUpdateAfter() {
    /* after re-render */
  },
  shouldUpdate(nextProps) {
    return nextProps.value !== props().value;
  },
  render() {
    text(props().value);
  },
}));
```

### Keyed Lists

Use `key` in props for efficient list reconciliation:

```ts
for (const item of items.get()) {
  TodoItem({ key: item.id, text: item.text, done: item.done });
}
```

### Conditional Rendering

Standard JavaScript control flow — no special syntax:

```ts
render() {
  if (editing.get()) {
    Editor({ key: id, value });
  } else {
    Display({ key: id, value });
  }
}
```

## Create App

Scaffold a new Creo project with one command:

```bash
bunx creo-create-app my-app
cd my-app
bun install
bun run dev
```

The CLI prompts whether to include a **Hono server**. When enabled, the generated project includes:

- A Hono backend (`src/server.ts`) serving static files from `dist/` by default
- Vite dev server with `/api` proxy to Hono
- Scripts for both dev (`dev:server` + `dev`) and production (`build` + `start`)

Without a server, you get a pure client-side Vite + Creo setup.

See [`packages/creo-create-app/`](./packages/creo-create-app/) for full details.

## Create Tauri App

Build cross-platform desktop and mobile apps with Creo + Tauri v2:

```bash
bunx creo-create-tauri-app my-app
cd my-app
bun install
bun run tauri:dev
```

The CLI lets you select target platforms: **macOS**, **Windows**, **Linux**, **iOS**, **Android**, and **Web**. Desktop targets work immediately; mobile targets require a one-time `tauri ios init` / `tauri android init` after scaffolding.

The generated project includes a full Tauri v2 setup (`src-tauri/`) with Rust backend, Vite frontend, and a sample Tauri command.

See [`packages/creo-create-tauri-app/`](./packages/creo-create-tauri-app/) for full details.

## Router

Hash-based router available as `creo-router` (separate package):

```ts
import { createRouter } from "creo-router";

const { routeStore, navigate, RouterView, Link } = createRouter({
  routes: [
    { path: "/", view: () => HomePage() },
    { path: "/users/:id", view: () => UserPage() },
  ],
  fallback: () => NotFoundPage(),
});

// Navigation:
Link({ href: "/users/42" }, () => text("User 42"));
navigate("/users/42"); // programmatic

// Read params:
const route = use(routeStore);
route.get().params.id; // "42"
```

## Development

```bash
bun install
bun test src/          # Run tests
bun tsc      # Type-check
bun run build          # Build to dist/

# Run examples:
cd examples/todo && bun install && bun run dev
cd examples/router && bun install && bun run dev
```