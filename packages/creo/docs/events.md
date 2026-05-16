# Events

Creo collects event handlers under a single `on` prop on primitives.

## Declaring handlers

Define event handler functions in the view function body, before returning the ViewBody. Reference them in render:

```ts
import { view, button, input, text } from "creo";
import type { PointerEventData, InputEventData } from "creo";

const MyForm = view((ctx) => {
  const value = ctx.use("");

  const handleClick = (e: PointerEventData) => {
    console.log("Clicked at", e.x, e.y);
  };

  const handleInput = (e: InputEventData) => {
    value.set(e.value);
  };

  return {
    render() {
      input({
        value: value.get(),
        placeholder: "Type here...",
        on: { input: handleInput },
      });
      button({ on: { click: handleClick } }, () => { text("Submit"); });
    },
  };
});
```

Declaring handlers before `return` keeps them as stable references across re-renders and keeps the render function clean. Better still: if you keep the entire `on: { … }` object stable (declared once outside `render`), the renderer skips the per-event diff with a single reference check.

## The `on` prop

Event handlers live under a single `on` key. Event names are the camelCase form of the DOM event (no `on` prefix). This keeps the renderer free of per-prop event detection: it special-cases one key (`on`) instead of scanning every prop for an `on*` pattern.

| Event key | Fires on | Event data type |
|---|---|---|
| `click` | Click / tap | `PointerEventData` |
| `dblclick` | Double click | `PointerEventData` |
| `pointerDown` | Pointer button pressed | `PointerEventData` |
| `pointerUp` | Pointer button released | `PointerEventData` |
| `pointerMove` | Pointer moved | `PointerEventData` |
| `keyDown` | Key pressed | `KeyEventData` |
| `keyUp` | Key released | `KeyEventData` |
| `focus` | Element focused | `FocusEventData` |
| `blur` | Element blurred | `FocusEventData` |
| `input` | Input value changed | `InputEventData` |
| `change` | Input value committed | `InputEventData` |

## Event data types

All event data types extend `BaseEventData`:

```ts
type BaseEventData = {
  stopPropagation: () => void;
  preventDefault: () => void;
};
```

### PointerEventData

```ts
type PointerEventData = BaseEventData & {
  x: number;  // clientX
  y: number;  // clientY
};
```

Used by `click`, `dblclick`, `pointerDown`, `pointerUp`, `pointerMove`.

### KeyEventData

```ts
type KeyEventData = BaseEventData & {
  key: string;   // e.g. "Enter", "a", "Escape"
  code: string;  // e.g. "KeyA", "Enter", "Space"
};
```

Used by `keyDown`, `keyUp`.

### InputEventData

```ts
type InputEventData = BaseEventData & {
  value: string;  // current input value
};
```

Used by `input`, `change`.

### FocusEventData

```ts
type FocusEventData = BaseEventData;
```

Used by `focus`, `blur`. Contains only the base methods.

## Event type maps

Creo defines two event maps that determine which events a primitive supports:

### ContainerEvents

Applies to most HTML elements (`div`, `span`, `button`, `li`, etc.):

```ts
type ContainerEvents = {
  click: (e: PointerEventData) => void;
  dblclick: (e: PointerEventData) => void;
  pointerDown: (e: PointerEventData) => void;
  pointerUp: (e: PointerEventData) => void;
  pointerMove: (e: PointerEventData) => void;
  keyDown: (e: KeyEventData) => void;
  keyUp: (e: KeyEventData) => void;
  focus: (e: FocusEventData) => void;
  blur: (e: FocusEventData) => void;
};
```

### FormEvents

Extends `ContainerEvents` with input-specific events. Applies to `input`, `textarea`, `select`:

```ts
type FormEvents = ContainerEvents & {
  input: (e: InputEventData) => void;
  change: (e: InputEventData) => void;
};
```

## Examples

### Keyboard navigation

```ts
const KeyNav = view((ctx) => {
  const selected = ctx.use(0);

  const handleKeyDown = (e: KeyEventData) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected.update(n => n + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected.update(n => Math.max(0, n - 1));
    }
  };

  return {
    render() {
      div({ tabindex: 0, on: { keyDown: handleKeyDown } }, () => {
        text(`Selected: ${selected.get()}`);
      });
    },
  };
});
```

### Controlled input

```ts
const SearchBox = view((ctx) => {
  const query = ctx.use("");

  const handleInput = (e: InputEventData) => query.set(e.value);

  return {
    render() {
      input({
        value: query.get(),
        placeholder: "Search...",
        on: { input: handleInput },
      });
    },
  };
});
```

### Preventing default behavior

```ts
const NoContextMenu = view((ctx) => ({
  render() {
    div(
      {
        on: {
          click: (e: PointerEventData) => {
            e.preventDefault();
            e.stopPropagation();
          },
        },
      },
      () => {
        text("Right-click has no effect here");
      },
    );
  },
}));
```

## Stable `on` objects (optional optimization)

The renderer short-circuits the per-event diff when `prev.on === next.on`. Two patterns work:

```ts
// Pattern A — declare the events object once, reuse it across renders.
const Counter = view(() => {
  const inc = () => count.update(n => n + 1);
  const events = { click: inc };

  return {
    render() {
      button({ class: "btn", on: events }, "+1");
    },
  };
});

// Pattern B — inline; the renderer diffs sub-keys, which is still cheap.
return {
  render() {
    button({ class: "btn", on: { click: inc } }, "+1");
  },
};
```

Both are correct. Pattern A skips the sub-diff entirely.
