# Creo UI Framework

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
