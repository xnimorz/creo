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
| `props.children` | `slot` — called as `slot?.()` inside render |
| `onClick={handler}` | `onClick: handler` in primitive props |
| `useEffect(() => {}, [])` (mount) | `mount.after()` |
| `useEffect(() => {}, [deps])` (update) | `update.after()` |
| `useLayoutEffect` (before paint) | `mount.before()` / `update.before()` |
| `React.memo(Component, areEqual)` | `update: { should: (nextProps) => boolean }` |
| `key={id}` | `{ key: id }` in props |
| `useContext` | `store.new()` + `use(store)` (global shared state) |
| `<div className="x">` | `div({ class: "x" }, () => { ... })` |
| `ReactDOM.createRoot(el).render(<App/>)` | `createApp(App, new HtmlRender(el)).mount()` |

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

// In parent render — slot is optional:
Card({}, () => {
  p(_, () => { text("hello"); }); // _ is imported from Maybe.ts
});
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
      button({ onClick: handleClick }, () => { text("Click"); });
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
```

### Lifecycle

| Phase | React | Creo |
|-------|-------|------|
| Before first render | — | `mount.before()` |
| After first mount | `useEffect(() => {}, [])` | `mount.after()` |
| Before re-render | — | `update.before()` |
| After re-render | `useEffect(() => {})` | `update.after()` |
| Skip render | `React.memo(cmp, fn)` | `update.should(nextProps)` |

### Key Differences from React

1. **Imperative render** — call primitives in `render()` instead of returning JSX. All JS cycles, if clauses are available to streamline your render.
2. **Handlers declared before ViewBody** — define handler functions in the viewFn body (before `return`), reference them in render. Keeps render clean, handlers stable
3. **State is deferred** — `set()`/`update()` queue changes, applied before next render
4. **Explicit lifecycle** — named hooks (`mount.before`, `update.after`) instead of `useEffect` with dependency arrays
5. **No JSX** — function calls instead of markup; `slot` instead of `children`
6. **Render returns void** — primitives are called for side effects (stream-based), not returned as a tree
7. **Slot is optional** — omit the second argument if no children needed
8. **Unified `use()`** — both local state and global store use the same `use()` function

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
      button({ onClick: reset }, () => {
        text("Reset");
      });
    },
  };
});
```

### State

- `use(initial)` must be called in the viewFn body (before returning ViewBody), never inside `render()`.
- State is cursor-tracked (like React hooks) — call order must be stable across re-renders.
- `set()` / `update()` queue changes. Values are applied (flushed) before the next render, not immediately.
- For ephemeral values that don't need re-renders (e.g., tracking current input text), use a plain `let` variable instead of state.

### Slot

Slot is optional. Omit it when a component has no children:

```ts
// No children:
button({ onClick: handler });
HeaderRow({ columns });

// With children:
div({ class: "wrapper" }, () => {
  text("hello");
});
```

## Types

- Use `Maybe<T>` from `@/functional/maybe` instead of `T | undefined`.
