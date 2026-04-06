# Creo: Lightweight UI framework

> _"There are many UI framework but this one is mine!"_

- Lightweight, "Streaming" UI framework.
- No JSX / templates / compiler
- Simplicity over tons of features
- Easy to start, easy to work with
- Extendability by defining renderers

## Philosophy

### Streaming the UI

> _"There is a point of no return"_

Most frameworks are based on "returning" the data. Creo started back in (early 2025)[https://x.com/xnimorz/status/1876212381568905348] with the idea, that "return" is not the point. We can intersect the components during rendering cycle to handle it.

It comes with some limitations, yes, like using VirtualDOM, instead of compiling it all and putting just renderer instructions but I believe VDOM is not the weakest point of modern software engineering.

The weakest point is complexity. Every time I looked at "framework A/B/C" I always find myself struggling with remembering all "you should do X/Y/Z in order to make it work".

And look.. I get it, it's important to follow the rules (e.g. I remember early svelte they experience problems with props, where incorrect usage de-optimised perfromance a lot). But after getting to the point where "a little bit too much" of the rules, I experience mental overload.

This is why I want to have a framework which I enjoy using on daily basis. And one major thing I don't like is "too many DSLs" to remember.

So... Why not just to use JAVASCRIPT?

```ts
render() {
  h1(_, "Title");                  // first child
  p(_, "Paragraph");               // second child
  ul(_, () => {                    // third child, with its own children streamed inside
    li(_, "One");
    li(_, "Two");
  });
}
```

### Native control flow

No `v-if`, no `{condition && <X/>}`, no `.map()` wrappers.
Creo renders imperatively: use `if`, `for`, `while`, `switch`, or any JavaScript you want.

**The language is the template language on its own**:

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

It reduces mental load. We don't require people to learn:

- Any specific templating syntax
- Framework-specific iteration helpers.
- Ternary gymnastics.

### Minimal model

The entire reactivity model is three concepts:

- **`use(value)`**: local state. Call `.get()`, `.set()`, `.update()`;
- **`store.new(value)`**: global store. Same interface. Any view can subscribe with `use(store)`, same to state mechanics. Library takes a shot to manage subscriptions;
- **`props()`**: read-only, passed by parent;

One of major ideas under the framework "if user can do it with same efficiency, let it outside framework zone". I want to keep the framework efficient, but with super limited API blast radius.

### Pluggable renderers

Creo allows any renderer overrides.

- **`HtmlRender`** — DOM output for browsers
- **`JsonRender`** — JSON AST for testing and serialization
- **`HtmlStringRenderer`** — HTML strings for SSR

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
import { createApp, view, div, text, button, _ } from "creo";
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
    div({ class: "greeting" }, `Hello, ${props().name}!`);
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
      h1(_, () => text(props().title));
      div({ class: "card-body" }, slot);
    });
  },
}));

// Usage:
Card({ title: "Hello" }, () => {
  p(_, "Card content here.");
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

## Conventions

### `_` for Empty Props

Use `_` (exported from `creo`) instead of `{}` when no props are needed:

```ts
h1(_, "Title");          // not h1({}, "Title")
div(_, () => { ... });   // not div({}, () => { ... })
```

### Inline Strings

Pass strings directly as slots instead of wrapping in `() => text(...)`:

```ts
button({ onClick: handler }, "Click me");   // not () => text("Click me")
li(_, "Item text");                         // not () => text("Item text")
```

Use `text()` only for dynamic values or when mixing text with other elements in a function slot.

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
Link({ href: "/users/42" }, "User 42");
navigate("/users/42"); // programmatic

// Read params:
const route = use(routeStore);
route.get().params.id; // "42"
```

## Development

```bash
bun install
bun test packages/creo/src/    # Run tests
bun run build                  # Build all packages
bun run typecheck              # Type-check

# Run examples:
cd examples/todo && bun install && bun run dev
cd examples/router && bun install && bun run dev

# Version management:
bun run version:patch          # Bump patch version across all packages
bun run version:minor          # Bump minor version
bun run version:major          # Bump major version

# Publishing:
bun run publish:all            # Dry-run publish (pass --no-dry-run to publish for real)
```
