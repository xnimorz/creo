# Styles

Creo is framework-agnostic about styling. Every primitive accepts a `class` prop and a `style` string prop — pick whichever approach your project already uses.

## Global CSS

The simplest option: a plain `.css` file imported once from your entry module.

```ts
// main.ts
import "./styles.css";
import { createApp, HtmlRender } from "creo";
// ...
```

```css
/* styles.css */
.button {
  padding: 8px 16px;
  border-radius: 6px;
  background: #4a90d9;
  color: #fff;
}
.button:hover { background: #357ac2; }
```

```ts
button({ class: "button", on: { click: handler } }, "Save");
```

## Conditional classes

Plain string concatenation works — no helper needed:

```ts
const cls = "nav-link" + (active ? " active" : "");
a({ href, class: cls }, title);
```

For more complex cases, a tiny helper keeps the render clean:

```ts
const cx = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");

a({ class: cx("nav-link", active && "active", disabled && "is-disabled") }, title);
```

## Inline styles

The `style` prop is a string — the same format as HTML's `style` attribute.

```ts
div({ style: `width: ${width}px; color: ${color}` }, () => { /* ... */ });
```

For dynamic values that change often, inline styles are fine. For static design, prefer classes — they're cheaper to diff.

## CSS Modules

Vite supports CSS Modules out of the box. Name the file `*.module.css`:

```css
/* Card.module.css */
.card {
  padding: 16px;
  border: 1px solid #eee;
}
.title { font-weight: 600; }
```

```ts
import styles from "./Card.module.css";

const Card = view<{ title: string }>(({ props, slot }) => ({
  render() {
    div({ class: styles.card }, () => {
      h2({ class: styles.title }, props().title);
      slot?.();
    });
  },
}));
```

The `styles` object is keyed by the class names you wrote — the values are hashed and isolated per module.

## Tailwind

Works with no extra wiring. Install Tailwind, include its CSS, and pass utility strings to `class`:

```ts
button({ class: "px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600" },
  "Save");
```

## Scoped styles without a CSS toolchain

If you want per-component styles without a bundler plugin, declare them inside a `<style>` tag in your HTML shell with a naming convention (BEM or a short prefix).

## Dynamic class lists for keyed lists

When a class depends on reactive state, compute it in `render()` — it's just a string:

```ts
for (const task of tasks.get()) {
  li(
    { key: task.id, class: task.done ? "task done" : "task" },
    task.title,
  );
}
```

Creo diffs `class` as a single string — no array or object normalization needed.

## Setting arbitrary attributes

`HtmlAttrs` has an index signature, so you can pass `data-*`, `aria-*`, or any custom attribute directly:

```ts
div(
  { class: "tab", role: "tab", "aria-selected": "true", "data-tab-id": id },
  title,
);
```
