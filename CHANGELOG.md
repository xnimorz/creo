# 0.2.8

1. `shallowEqual` now does a one-level-deeper compare when it encounters the `on` key, so callers writing `button({ on: { click: handler } })` inline don't pay for redundant primitive re-renders when handler references are stable.
7. Distribute guidance docs in the npm tarball — `CHANGELOG.md`, `AGENTS.md`, and the `docs/` folder are now copied into the `creo` package on build and shipped with publish.

# 0.2.7

1. Add support for new api `dispose`
2. Add `ref` to primitives (DOM element) and composite views (exposed API)
3. Provider-side rename: `ctx.expose(...)` is now `ctx.ref(...)`, matching the consumer-side `ref` prop. `Expose<Api>` is now `RefSetter<Api>`.
4. Event handlers move from flat `on*` props to a nested `on: { ... }` object — e.g. `button({ on: { click: handler } })`. Removes the per-prop `isEventProp` charCode scan from the renderer's hot path; the `on` object's reference identity short-circuits the event diff. `EventHandlerProps<>` is removed.
5. Drop `mouseEnter` / `mouseLeave` — use `pointerEnter` / `pointerLeave`. PointerEvents already cover mouse, touch, and pen via the `pointerType` field, so the duplicate mouse-only events were dead weight.

## Migration from 0.2.6

### Event handlers: flat `on*` props → nested `on: { ... }` object

Event names lose the `on` prefix and the leading-capital — they become the camelCase form already used in `ContainerEvents` / `FormEvents` / `MediaEvents` (`click`, `pointerDown`, `keyDown`, `volumeChange`, …).

```ts
// Before
button({ class: "btn", onClick: handleClick }, "Save");
input({
  value: v.get(),
  onInput: handleInput,
  onKeyDown: handleKey,
  onBlur: handleBlur,
});
details({ onToggle: (e) => log(e.open) }, () => summary(_, "more"));

// After
button({ class: "btn", on: { click: handleClick } }, "Save");
input({
  value: v.get(),
  on: { input: handleInput, keyDown: handleKey, blur: handleBlur },
});
details({ on: { toggle: (e) => log(e.open) } }, () => summary(_, "more"));
```

Mapping table for every prop the framework defines:

| Before                           | After (key inside `on: { ... }`) |
| -------------------------------- | -------------------------------- |
| `onClick`                        | `click`                          |
| `onDblclick`                     | `dblclick`                       |
| `onPointerDown`                  | `pointerDown`                    |
| `onPointerUp`                    | `pointerUp`                      |
| `onPointerMove`                  | `pointerMove`                    |
| `onPointerCancel`                | `pointerCancel`                  |
| `onPointerEnter`                 | `pointerEnter`                   |
| `onPointerLeave`                 | `pointerLeave`                   |
| `onMouseEnter`                   | use `pointerEnter`               |
| `onMouseLeave`                   | use `pointerLeave`               |
| `onKeyDown`                      | `keyDown`                        |
| `onKeyUp`                        | `keyUp`                          |
| `onFocus`                        | `focus`                          |
| `onBlur`                         | `blur`                           |
| `onInput`                        | `input`                          |
| `onChange`                       | `change`                         |
| `onScroll`                       | `scroll`                         |
| `onLoad`                         | `load`                           |
| `onError`                        | `error`                          |
| `onToggle`                       | `toggle`                         |
| `onVolumeChange`                 | `volumeChange`                   |
| `onPlay` / `onPause` / `onEnded` | `play` / `pause` / `ended`       |
| `onTimeUpdate`                   | `timeUpdate`                     |
| `onLoadedMetadata`               | `loadedMetadata`                 |
| `onLoadedData`                   | `loadedData`                     |
| `onCanPlay`                      | `canPlay`                        |
| `onCanPlayThrough`               | `canPlayThrough`                 |
| `onDurationChange`               | `durationChange`                 |
| `onRateChange`                   | `rateChange`                     |
| `onSeeking` / `onSeeked`         | `seeking` / `seeked`             |
| `onStalled` / `onWaiting`        | `stalled` / `waiting`            |

Only primitive event props move. Custom `on*` props you define on your own views (`TodoItem({ onEdit, onSave })`, etc.) are plain props — leave them as-is.

**Optional perf tip.** If you hoist the events object once, the renderer skips the per-event diff via `prev.on === next.on`:

```ts
const events = { click: handleClick, pointerDown: handleDown };
// inside render():
button({ class: "btn", on: events }, "Save");
```

Inline `on: { ... }` still works; the renderer falls back to a sub-key diff, which is still cheap.

### Exposing an API: `ctx.expose(api)` → `ctx.ref(api)`

Pure rename — same semantics, same `applyRef` wiring. The provider verb now uses the same word as the consumer noun.

```ts
// Before
const TextInput = view<{ placeholder: string }, { focus: () => void }>(
  ({ props, expose }) => {
    let el: HTMLInputElement | null = null;
    expose({ focus: () => el?.focus() });
    return {
      render() {
        input({
          placeholder: props().placeholder,
          ref: (e) => {
            el = e as HTMLInputElement;
          },
        });
      },
    };
  },
);

// After
const TextInput = view<{ placeholder: string }, { focus: () => void }>(
  ({ props, ref }) => {
    let el: HTMLInputElement | null = null;
    ref({ focus: () => el?.focus() });
    return {
      render() {
        input({
          placeholder: props().placeholder,
          ref: (e) => {
            el = e as HTMLInputElement;
          },
        });
      },
    };
  },
);
```

The `Expose<Api>` type export is now `RefSetter<Api>`.

The consumer side is unchanged: `TextInput({ placeholder: "Email", ref: myRef })`.

### Removed type exports

- `Expose<Api>` → renamed to `RefSetter<Api>`
- `EventHandlerProps<Events>` → removed. The replacement shape is just `{ on?: Partial<Events> }`, applied automatically by `PrimitiveProps<Attrs, Events>`.

# 0.2.6

1. Cache first mount render props for primitives
2. Fix re-bounding event to primitives
3. Fix old children slice handling to avoid incorrect data duplicity
4. Support chainable state & store
5. Improve child placement lookup performance from O(N) to O(1)
6. Improve "live-DOM" value handling: value, mute, checked
7. Make stores to use publicly visible symbol Symbol.for("creo.store")
8.
