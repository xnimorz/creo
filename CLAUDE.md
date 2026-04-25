# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Creo UI Framework

Imperative UI framework with virtual DOM. No JSX — views are function calls (`div()`, `text()`). Reactivity via `use()` (local state) and `store` (global). Reconciler uses Vue 3-style keyed diffing with LIS. Runtime is Bun; workspaces layout.

See [AGENTS.md](AGENTS.md) for deep architecture notes (engine internals, flags, reconciliation algorithm, render loop). Prefer reading it before modifying `packages/creo/src/internal/` or `packages/creo/src/render/`.

## Commands

```bash
bun install
bun test packages/creo/src/                          # all tests (happy-dom)
bun test packages/creo/src/render/render.spec.ts    # single file
bun test packages/creo/src/render/benchmark.spec.ts # perf benchmarks
bun run typecheck                                    # tsc --noEmit
bun run build                                        # build creo first, then dependents
bun run version:patch|minor|major                    # bump all packages
bun run publish:all                                  # dry-run (pass --no-dry-run to publish)

# Run an example:
cd examples/todo && bun install && bun run dev
```

Tests live only under `packages/creo/src/`. There is no lint command.

## Repo Layout

Monorepo with `packages/*` workspaces:

- `packages/creo` — core framework (engine, renderers, primitives, view/state/store)
- `packages/creo-router` — hash-based router (separate package)
- `packages/creo-editor` — editor component
- `packages/creo-create-app` — CLI scaffolder (Vite, optional Hono server)
- `packages/creo-create-tauri-app` — CLI scaffolder (Tauri v2, desktop + mobile)
- `packages/creo-create-electron-app` — CLI scaffolder (Electron)
- `examples/` — todo, router, table, chess, editor, canvas-demo, benchmark, perf_profiler
- `scripts/version.ts`, `scripts/publish.ts` — release orchestrators
- `docs/` — user-facing docs (view, state, store, lifecycle, events, primitives, renderers)

Core source map (see AGENTS.md for details):

- `src/internal/engine.ts` — reconciler, dirty queue, render loop
- `src/internal/internal_view.ts` — `ViewRecord`, flags (`F_PENDING`, `F_DIRTY`, `F_MOVED`, `F_PRIMITIVE`, `F_TEXT_CONTENT`)
- `src/public/view.ts`, `state.ts`, `store.ts`, `app.ts` — public API surface
- `src/render/{html,json,string}_render.ts` — renderer implementations behind `IRender<Output>`
- `src/functional/lis.ts` — LIS for keyed reconciliation

## Workflow Notes

- After engine changes, run full `bun test packages/creo/src/` and visually verify with `examples/todo` and `examples/router`.
- Build order matters: the root `build` script runs `creo` first, then everything else. Don't reorder.
- Adding a primitive: edit `packages/creo/src/public/primitives/primitives.ts` and re-export from `packages/creo/src/index.ts`.

---

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

Prefer passing a string directly as a slot instead of wrapping in `() => text("...")`. The engine auto-wraps strings into text nodes (detected via `typeof slot === "string"` in `engine.ts`):

```ts
// Preferred — inline string (static or dynamic):
button({ onClick: handler }, "Click me");
h1(_, "Page Title");
li(_, "Item text");
span({ class: "label" }, userName);
div({ class: "greeting" }, `Hello, ${props().name}!`);  // template literals are strings
p(_, String(count.get()));

// Avoid — unnecessary text() wrapper:
button({ onClick: handler }, () => text("Click me"));
h1(_, () => text("Page Title"));
```

**Gotcha — function slots do NOT auto-text their return value.** A function slot runs for side effects; any returned value is discarded. This means:

```ts
// ❌ Renders nothing — the returned string is discarded.
div({ class: "greeting" }, () => `Hello, ${props().name}!`);

// ✅ String slot (preferred for single dynamic string).
div({ class: "greeting" }, `Hello, ${props().name}!`);

// ✅ Function slot that calls text() explicitly.
div({ class: "greeting" }, () => text(`Hello, ${props().name}!`));
```

Use `text()` only when you need to mix text with other elements inside a function slot:

```ts
div({ class: "wrapper" }, () => {
  span(_, "hello");
  text(" world");  // text() needed here — mixed content in function slot
});
```

**When to use each slot form:**

| Children | Use |
|---|---|
| None | omit second arg: `button({ onClick })` |
| Single string (static or dynamic) | string slot: `h1(_, title)` |
| Single child view | function slot: `section(_, () => UserCard({ id }))` |
| Multiple children | function slot with primitives / views inside |
| Mixed text + elements | function slot + explicit `text()` for the text parts |

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
