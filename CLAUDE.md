# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Creo is a lightweight imperative UI framework with a virtual DOM, no JSX, and pluggable renderers. Runtime is Bun. The repo is a Bun workspace monorepo (`packages/*`). See `AGENTS.md` for deeper engine internals (flags, render loop flow, reconciliation algorithm) — that file is the authoritative reference when touching `packages/creo/src/internal/engine.ts` or the renderers.

## Development Commands

```bash
bun install                                          # Install deps (workspace-wide)
bun test packages/creo/src/                          # All tests (happy-dom)
bun test packages/creo/src/render/render.spec.ts     # A single test file
bun test packages/creo/src/render/benchmark.spec.ts  # Perf benchmarks (correctness-validating)
bun run build                                        # Build all packages (per-package build.ts)
bun run typecheck                                    # tsc --noEmit across workspace

# Versioning & publishing (orchestrated across all packages):
bun run version:patch | version:minor | version:major
bun run publish:all                                  # Dry-run; pass --no-dry-run to publish

# Run an example (hot reload via Vite):
cd examples/todo && bun install && bun run dev
cd examples/router && bun install && bun run dev
```

Tests use `happy-dom` for DOM simulation. The top-level `bun test` script only targets `packages/creo/src/` — other packages (router, scaffolds) don't have test suites routed through root.

## Monorepo Layout

- `packages/creo/` — core framework (engine, views, state, store, primitives, renderers)
- `packages/creo-router/` — hash-based router (separate package, imports `creo`)
- `packages/creo-create-app/` — `bunx creo-create-app` scaffolding CLI
- `packages/creo-create-tauri-app/` — Tauri v2 scaffolding CLI
- `examples/` — `todo`, `router`, `table`, `chess`, `benchmark`, `perf_profiler` (used for visual verification and perf validation)
- `scripts/version.ts`, `scripts/publish.ts` — cross-package version/publish orchestration
- `docs/` — user-facing markdown docs

Path aliases (`tsconfig.json`): `@/*` → `packages/creo/src/*`, `creo` → core entry, `creo-router` → router entry. Use these in tests and internal code rather than relative `../../`.

## Architecture (high level)

- **Streaming render model** — `render()` returns `void` and calls primitives (`div`, `text`, …) imperatively. There is no returned tree; the engine intercepts calls during the render pass. All JS control flow (`if`/`for`/`while`) works directly.
- **Views**: `view<Props>(setupFn)` returns a callable `(props, slot?) => void`. `setupFn` runs **once** per view lifecycle and returns a `ViewBody` with `render()` + optional `onMount` / `onUpdateBefore` / `onUpdateAfter` / `shouldUpdate`. `render()` runs on every update.
- **Reactivity** has three primitives: `use(value)` (local `State`), `store.new(value)` (global `Store`), `use(store)` (subscribe). `.set()` / `.update()` write immediately and schedule a re-render async; `.get()` reads the committed value.
- **Engine** (`packages/creo/src/internal/engine.ts`): dirty-queue based render loop. `markDirty` adds views to a `Set`, `schedule()` flushes. For each dirty view: `initViewBody` (if `F_PENDING`) → `reconcile` → `renderer.render` → clear flags → fire deferred `onMount`/`onUpdateAfter`.
- **ViewRecord** (`internal_view.ts`) is a plain GC'd object with parent pointer + children array. Composites have **no DOM footprint** (they use a `renderRef = true` mounted marker); primitives store `{ element, prevProps }` as `renderRef`. Discriminate via `flags & F_PRIMITIVE`.
- **Reconciliation** is Vue 3-style keyed diff: head sync → tail sync → pure insert/remove shortcut → middle diff with `newKeyToIndex` + LIS (`functional/lis.ts`) to minimize moves. Non-keyed is positional.
- **Slots** are pre-collected: `newView()` eagerly evaluates the slot into `view.sc` so structural comparison works without re-running the slot. `scHost` + `#propagateScProps` short-circuits slot-prop-only updates without re-reconciling the composite. `#patchOrReplace` passes `pendView.sc` as `preCollectedSc` to avoid double evaluation.
- **Renderers** implement `IRender<Output>` (`render/render_interface.ts`): `HtmlRender` (DOM, Inferno-style event delegation — one listener per event type on the container; handlers stored on elements via `Symbol.for("creo.ev")`), `JsonRender` (AST for tests), `StringRender` (SSR strings). `textContent` shortcut: single-text-child primitives set `element.textContent` directly and mark the child `F_TEXT_CONTENT`. Dispose of a DOM-bearing primitive routes descendants through `#disposeVirtual` (skips per-node unmount — parent removal handles it).
- **Flags** (`internal_view.ts`): `F_PENDING=1`, `F_DIRTY=1<<1`, `F_MOVED=1<<2`, `F_PRIMITIVE=1<<3`, `F_TEXT_CONTENT=1<<4`.

### When modifying the engine or renderer

- Engine changes: run the full `bun test packages/creo/src/` suite (includes the 1000-row benchmark correctness tests) **and** spot-check `examples/todo` + `examples/router` visually (`bun run dev`).
- HTML renderer changes: `findParentDom(view)` walks up to the nearest primitive; `findInsertionPoint(view)` scans siblings and recurses up through composites. Both examples must still render correctly.
- Changing `ViewRecord` shape: update the type in `internal_view.ts`, field initialization in `newView()` (engine.ts), cleanup in `#disposeVirtual`, and verify JSON / String renderers don't read the old field.
- Adding a primitive: add to `packages/creo/src/public/primitives/primitives.ts` using `html<Attrs, Events>("tag")` and re-export from `packages/creo/src/index.ts`.

---

# Creo Framework API (when writing views in this repo or examples)

## React → Creo Translation

### Component Definition

React:
```tsx
function Counter({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

Creo:
```ts
const Counter = view<{ initial: number }>(({ props, use }) => {
  const count = use(props().initial);
  const handleClick = () => count.update(n => n + 1);

  return {
    render() {
      button({ onClick: handleClick }, () => {
        text(count.get());
      });
    },
  };
});
```

### Key Mappings

| React | Creo |
|-------|------|
| `function Component(props)` | `view<Props>(({ props }) => ({ render() {} }))` — `props` is a function: call `props()` |
| `useState(initial)` | `use(initial)` → `.get()` / `.set()` / `.update()` |
| `props.children` | `slot` — called as `slot?.()` inside render; callers can pass a string or `() => void` |
| `onClick={handler}` | `onClick: handler` in primitive props |
| `useEffect(() => {}, [])` (mount) | `onMount()` on ViewBody |
| `useEffect(() => {})` (update) | `onUpdateAfter()` on ViewBody |
| `useLayoutEffect` (before paint) | `onUpdateBefore()` on ViewBody |
| `React.memo(Component, areEqual)` | `shouldUpdate(nextProps)` on ViewBody |
| `key={id}` | `{ key: id }` in props |
| `useContext` | `store.new()` + `use(store)` (global shared state) |
| `<div className="x">` | `div({ class: "x" }, () => { ... })` — use `_` instead of `{}` when no props |
| `ReactDOM.createRoot(el).render(<App/>)` | `createApp(() => App(), new HtmlRender(el)).mount()` |

### Children / Composition

React:
```tsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}
<Card><p>hello</p></Card>
```

Creo:
```ts
const Card = view(({ slot }) => ({
  render() {
    div({ class: "card" }, slot);
  },
}));

// In parent render — slot is optional; use _ when no props:
Card(_, () => {
  p(_, "hello");
});

// String slot — shorthand for () => text("..."):
Card(_, "simple text content");
```

### Event Handling

React:
```tsx
<button onClick={(e) => handleClick(e)}>Click</button>
<input onChange={(e) => setValue(e.target.value)} />
```

Creo — declare handlers before ViewBody, pass as `on*` props:
```ts
const MyView = view(({ use }) => {
  const value = use("");
  const handleClick = () => { ... };
  const handleInput = (e: InputEventData) => value.set(e.value);

  return {
    render() {
      button({ onClick: handleClick }, "Click");
      input({ value: value.get(), onInput: handleInput });
    },
  };
});
```

| Event prop | Event data type | Fields |
|---|---|---|
| `onClick` | `PointerEventData` | `x`, `y` |
| `onDblclick` | `PointerEventData` | `x`, `y` |
| `onPointerDown` | `PointerEventData` | `x`, `y` |
| `onPointerUp` | `PointerEventData` | `x`, `y` |
| `onPointerMove` | `PointerEventData` | `x`, `y` |
| `onFocus` | `FocusEventData` | — |
| `onBlur` | `FocusEventData` | — |
| `onInput` | `InputEventData` | `value` |
| `onChange` | `InputEventData` | `value` |
| `onKeyDown` | `KeyEventData` | `key`, `code` |
| `onKeyUp` | `KeyEventData` | `key`, `code` |

All event data includes `stopPropagation()` and `preventDefault()` from `BaseEventData`.

### Conditional Rendering

React:
```tsx
{isEditing ? <Input /> : <Display />}
```

Creo:
```ts
if (isEditing.get()) {
  EditableCell({ key: id, value });
} else {
  DisplayCell({ key: id, value });
}
```

### Lists

React:
```tsx
{items.map(item => <Item key={item.id} data={item} />)}
```

Creo:
```ts
for (const item of items.get()) {
  Item({ key: item.id, data: item });
}
```

### State & Store

Local state (inside a view):
```ts
const count = use(0);
count.set(5);              // set immediately, schedule render
count.update(n => n + 1);  // functional, chains through pending
count.update(async n => {  // async supported
  const data = await fetch(...);
  return n + data.value;
});
count.get();               // read committed value
```

Global store (outside views):
```ts
const ThemeStore = store.new("light");
ThemeStore.set("dark"); // updates all subscribers

// Inside a view:
const theme = use(ThemeStore); // subscribes, re-renders on change
theme.get(); // "dark"
theme.set("light"); // updates the store, all subscribers re-render
```

### Lifecycle

| Phase | React | Creo (ViewBody property) |
|-------|-------|------|
| After first mount | `useEffect(() => {}, [])` | `onMount()` |
| Before re-render | — | `onUpdateBefore()` |
| After re-render | `useEffect(() => {})` | `onUpdateAfter()` |
| Skip render | `React.memo(cmp, fn)` | `shouldUpdate(nextProps)` |

```ts
const MyView = view<{ value: number }>(({ props }) => ({
  onMount() {
    console.log("mounted");
  },
  onUpdateBefore() {
    console.log("about to re-render");
  },
  onUpdateAfter() {
    console.log("re-rendered");
  },
  shouldUpdate(nextProps) {
    return nextProps.value !== props().value;
  },
  render() {
    text(props().value);
  },
}));
```

### Key Differences from React

1. **Imperative render** — call primitives in `render()` instead of returning JSX. All JS control flow (`if`, `for`, `while`) available directly.
2. **Handlers declared before ViewBody** — define handler functions in the viewFn body (before `return`), reference them in render. Keeps render clean, handlers stable.
3. **State is immediate** — `set()` updates the value immediately; `get()` returns the new value right away. Re-render is scheduled asynchronously.
4. **Explicit lifecycle** — named hooks (`onMount`, `onUpdateBefore`, `onUpdateAfter`) on ViewBody instead of `useEffect` with dependency arrays.
5. **No JSX** — function calls instead of markup; `slot` instead of `children`.
6. **Render returns void** — primitives are called for side effects (stream-based), not returned as a tree.
7. **Slot is optional** — omit the second argument if no children needed.
8. **Unified `use()`** — both local state and global store use the same `use()` function.
9. **`text()` is typed** — `text(content: string | number)`, not a generic element.
10. **`_` for empty props** — use `_` (from `@/functional/maybe`) instead of `{}` when no props are needed: `div(_, "hello")` not `div({}, "hello")`.

---

## Patterns

### Event Handlers

Declare handler functions before returning ViewBody. Pass them as `on*` props on primitives. This keeps handlers stable across re-renders and render functions clean:

```ts
const MyView = view(({ use }) => {
  const count = use(0);

  // Declare handlers here — stable references, access state via .get()
  const increment = () => count.update(n => n + 1);
  const reset = () => count.set(0);

  return {
    render() {
      button({ onClick: increment }, () => {
        text(count.get());
      });
      button({ onClick: reset }, "Reset");
    },
  };
});
```

### State

- `use(initial)` must be called in the viewFn body (before returning ViewBody), never inside `render()`.
- `use()` is called **once** per view lifecycle (when the component is first created). It is NOT called on re-render — only `render()` is called on re-render.
- `set()` / `update()` update the value immediately and schedule a re-render.
- For ephemeral values that don't need re-renders (e.g., tracking current input text), use a plain `let` variable instead of state.

### Slot

Slot accepts a function `() => void` or a `string`. A string slot is shorthand for `() => text("...")`. Omit it when a component has no children:

```ts
// No children:
button({ onClick: handler });
HeaderRow({ columns });

// String slot — renders as a text node:
button({ onClick: handler }, "Click me");
span({ class: "label" }, title);
li(_, "Item text");

// Function slot — for complex children:
div({ class: "wrapper" }, () => {
  span(_, "hello");
  text(" world");
});
```

### Inline Strings

Prefer passing a string directly as a slot instead of wrapping in `() => text("...")`. The engine auto-wraps strings into text nodes:

```ts
// Preferred — inline string:
button({ onClick: handler }, "Click me");
h1(_, "Page Title");
li(_, "Item text");
span({ class: "label" }, userName);

// Avoid — unnecessary text() wrapper:
button({ onClick: handler }, () => text("Click me"));
h1(_, () => text("Page Title"));
```

Use `text()` only when you need to mix text with other elements inside a function slot:

```ts
div({ class: "wrapper" }, () => {
  span(_, "hello");
  text(" world");  // text() needed here — mixed content in function slot
});
```

### `_` for Empty Props

Always use `_` (imported from `@/functional/maybe`) instead of `{}` when a primitive or view needs no props:

```ts
import { _ } from "@/functional/maybe";

// Preferred:
div(_, () => { ... });
h1(_, "Title");
li(_, "Item");

// Avoid:
div({}, () => { ... });
h1({}, "Title");
li({}, "Item");
```

When props are needed, pass the object as normal — `_` is only for the no-props case:

```ts
div({ class: "card" }, () => { ... });  // props needed — use object
div(_, () => { ... });                  // no props — use _
```

### Router (creo-router)

Hash-based router available as a separate package (`packages/creo-router`):

```ts
import { createRouter } from "creo-router";

const { routeStore, navigate, RouterView, Link } = createRouter({
  routes: [
    { path: "/", view: () => HomePage() },
    { path: "/about", view: () => AboutPage() },
    { path: "/users/:id", view: () => UserPage() },
  ],
  fallback: () => NotFoundPage(),
});

// In a view's render():
nav(_, () => {
  Link({ href: "/" }, "Home");
  Link({ href: "/about" }, "About");
});
div({ class: "content" }, () => {
  RouterView();
});

// _ (from @/functional/maybe) is used instead of {} when no props are needed

// Read route params:
const route = use(routeStore);
const userId = route.get().params.id;

// Programmatic navigation:
navigate("/users/42");
```

## Types

- Use `Maybe<T>` from `@/functional/maybe` instead of `T | undefined`.
- `text(content: string | number)` — typed scalar, not a generic element.
- `view<Props, Api>` — returns `(props, slot?: SlotContent) => void`. `SlotContent = (() => void) | string`.
- `store.new<T>(initial)` — creates `Store<T>` with `.get()`, `.set()`, `.update()`, `.subscribe()`.
- `use(store)` returns the `Store<T>` itself (implements `Reactive<T>`).
- `use(value)` returns a `Reactive<T>` (local `State<T>`).
