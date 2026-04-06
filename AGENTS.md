# Agent Guide for Creo

## What is Creo?

Creo is an imperative UI framework with virtual DOM. No JSX — views are function calls (`div()`, `text()`, `span()`). State is reactive (`use()`, `store`). Reconciliation uses Vue 3-style keyed diffing with LIS.

## Project Layout

```
src/internal/engine.ts        — Core: reconciler, dirty queue, render loop
src/internal/internal_view.ts  — ViewRecord type, flags, structural comparison
src/internal/orchestrator.ts   — Tracks current active engine
src/public/view.ts             — view() factory, ViewBody, Slot types
src/public/state.ts            — State, Reactive, Use types
src/public/store.ts            — Store (global reactive state)
src/public/app.ts              — createApp() entry point
src/public/primitives/         — HTML element factories (div, span, text, etc.)
src/public/primitive.ts        — $primitive symbol, EventHandlerProps
src/render/html_render.ts      — DOM renderer (event delegation, attribute diffing)
src/render/json_render.ts      — JSON AST renderer (testing)
src/render/string_render.ts    — HTML string renderer (SSR)
src/render/render_interface.ts — IRender<Output> interface
src/functional/lis.ts          — Longest Increasing Subsequence (keyed reconciliation)
src/functional/shallow_equal.ts — Object comparison (no Object.keys allocation)
packages/creo-router/          — Hash-based router (separate package)
```

## Key Architecture Decisions

### ViewRecord is a plain object (not pooled)
Views are GC'd objects with direct parent pointers (`view.parent: Maybe<ViewRecord>`). Children are arrays (`view.children: Maybe<ViewRecord[]>`). No arena allocator, no numeric IDs, no linked lists.

### Composites have no DOM footprint
Unlike React (which doesn't either) or the old creo (which used comment nodes), composite views set `renderRef = true` as a mounted marker. No DOM nodes are created for composites.

### Primitives store `{ element, prevProps }` as renderRef
The `kind` discriminant was removed. Use `view.flags & F_PRIMITIVE` to distinguish primitives from composites.

### Slot children (sc) are pre-collected
When a view has a slot, `newView()` calls `#collect(slot, [], res)` to eagerly evaluate the slot and store results in `view.sc`. This enables structural comparison (`hasScStructuralChange`) without re-running the slot.

### scHost optimization
Composites that receive a slot track `view.scHost` — the primitive whose `.children` contains the live slot children. When slot children have prop changes but identical structure, `#propagateScProps` updates live children directly, skipping the composite's reconcile.

### preCollectedSc
`#patchOrReplace` passes `pendView.sc` to `nextProps` as `preCollectedSc`, avoiding double slot evaluation. The sc items get re-parented to the old view.

### Event delegation
HTML renderer uses Inferno-style delegation: one listener per event type on the container element. Handlers are stored on elements via `Symbol.for("creo.ev")`. Zero closures per element — handler mapping happens at dispatch time.

### textContent shortcut
When a primitive has a single text child, the renderer sets `element.textContent` directly instead of creating a Text node. The text child gets `F_TEXT_CONTENT` flag.

### Dispose optimization
When a primitive with DOM is disposed, its children go through `#disposeVirtual` (skips `renderer.unmount`) since removing the parent element removes all descendants from DOM automatically.

## Flags (internal_view.ts)

```
F_PENDING      = 1      — View not yet initialized (body is null)
F_DIRTY        = 1 << 1 — Needs reconcile + render
F_MOVED        = 1 << 2 — Position changed, needs DOM repositioning
F_QUICK_RERENDER = 1 << 3 — (reserved)
F_PRIMITIVE    = 1 << 4 — Is an HTML element/text, not a composite
F_TEXT_CONTENT = 1 << 5 — Text rendered via parent's textContent
```

## Render Loop Flow

```
markDirty(view) → add to #dirtyQueue Set → schedule()
                                              ↓
render() processes #dirtyQueue:
  for each view in Set (visits items added during iteration):
    1. initViewBody(view) — if F_PENDING, call viewFn once
    2. isNew = !view.renderRef
    3. if F_DIRTY:
       a. reconcile(view) — collect pending children, diff with old
       b. renderer.render(view) — mount or update DOM
       c. clear F_DIRTY, F_MOVED
    4. else (F_MOVED only):
       a. renderer.render(view) — reposition DOM
       b. clear F_MOVED
  #dirtyQueue.clear()
  fire deferred callbacks (onMount, onUpdateAfter)
```

## Reconciliation Algorithm

### Non-keyed
Position-based: `old[i]` paired with `pending[i]`. Same viewFn → `nextProps`. Different → dispose + init. Extras disposed or mounted.

### Keyed (Vue 3-style)
1. **Head sync** — match from start while keys equal
2. **Tail sync** — match from end while keys equal
3. **Simple cases** — pure insertion or pure removal
4. **Middle diff** — build `newKeyToIndex` map, compute `newIdxToOldIdx`, find LIS. Views in LIS stay; others get `markMoved`.

## Testing

```bash
bun test src/                    # All tests (100)
bun test src/render/render.spec.ts   # Renderer + state tests (35)
bun test src/internal/           # Virtual DOM correctness (21)
bun test src/render/benchmark.spec.ts # Performance benchmarks (8)
```

Tests use happy-dom for DOM simulation. The benchmark tests validate correctness of create/update/swap/select/remove/clear/replace operations on 1000-row tables.

## Common Patterns When Modifying

### Adding a new primitive
Add to `src/public/primitives/primitives.ts`:
```ts
export const myTag = html<HtmlAttrs & { myProp?: string }, ContainerEvents>("my-tag");
```
Export from `src/index.ts`.

### Changing the engine
- `engine.ts` is the core — reconciler, dirty queue, render loop
- After changes, run `bun test src/` (all 100 tests must pass)
- Test with `cd examples/todo && bun run dev` for visual verification

### Changing the HTML renderer
- `html_render.ts` — DOM operations, event delegation, attribute diffing
- `findParentDom(view)` walks parent chain for nearest primitive element
- `findInsertionPoint(view)` scans siblings + recurses up for composites
- After changes, verify with both todo and router examples

## Conventions

### `_` for Empty Props
Always use `_` (from `@/functional/maybe`, re-exported by `creo`) instead of `{}` when a primitive or view needs no props:
```ts
div(_, () => { ... });   // not div({}, () => { ... })
h1(_, "Title");          // not h1({}, "Title")
```

### Inline Strings
Prefer passing strings directly as slots instead of wrapping in `() => text(...)`. The engine auto-wraps strings into text nodes:
```ts
button({ onClick: handler }, "Click me");   // not () => text("Click me")
li(_, "Item text");                         // not () => text("Item text")
span({ class: "label" }, title);            // string variable works too
```
Use `text()` only for dynamic values or when mixing text with other elements inside a function slot.

### Changing ViewRecord shape
- Update type in `internal_view.ts`
- Update `newView()` in `engine.ts` (initializes all fields)
- Update `#disposeVirtual()` if new field needs cleanup
- JSON/String renderers may need updates if they access the field
