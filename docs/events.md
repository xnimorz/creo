# Events

Creo uses `on*` props on primitives to handle user interactions.

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
      input({ value: value.get(), onInput: handleInput, placeholder: "Type here..." });
      button({ onClick: handleClick }, () => { text("Submit"); });
    },
  };
});
```

Declaring handlers before `return` keeps them as stable references across re-renders and keeps the render function clean.

## Event props

Event props follow the pattern `on` + capitalized event name:

| Event prop | Fires on | Event data type |
|---|---|---|
| `onClick` | Click / tap | `PointerEventData` |
| `onDblclick` | Double click | `PointerEventData` |
| `onPointerDown` | Pointer button pressed | `PointerEventData` |
| `onPointerUp` | Pointer button released | `PointerEventData` |
| `onPointerMove` | Pointer moved | `PointerEventData` |
| `onKeyDown` | Key pressed | `KeyEventData` |
| `onKeyUp` | Key released | `KeyEventData` |
| `onFocus` | Element focused | `FocusEventData` |
| `onBlur` | Element blurred | `FocusEventData` |
| `onInput` | Input value changed | `InputEventData` |
| `onChange` | Input value committed | `InputEventData` |

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

Used by `onClick`, `onDblclick`, `onPointerDown`, `onPointerUp`, `onPointerMove`.

### KeyEventData

```ts
type KeyEventData = BaseEventData & {
  key: string;   // e.g. "Enter", "a", "Escape"
  code: string;  // e.g. "KeyA", "Enter", "Space"
};
```

Used by `onKeyDown`, `onKeyUp`.

### InputEventData

```ts
type InputEventData = BaseEventData & {
  value: string;  // current input value
};
```

Used by `onInput`, `onChange`.

### FocusEventData

```ts
type FocusEventData = BaseEventData;
```

Used by `onFocus`, `onBlur`. Contains only the base methods.

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
      div({ tabindex: 0, onKeyDown: handleKeyDown }, () => {
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
        onInput: handleInput,
        placeholder: "Search...",
      });
    },
  };
});
```

### Preventing default behavior

```ts
const NoContextMenu = view((ctx) => ({
  render() {
    div({
      onClick: (e: PointerEventData) => {
        e.preventDefault();
        e.stopPropagation();
      },
    }, () => {
      text("Right-click has no effect here");
    });
  },
}));
```
