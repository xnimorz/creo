# view()

`view()` is the core API for defining components in Creo.

## Signature

```ts
function view<Props = void, Api = void>(
  viewFn: ViewFn<Props, Api>
): (props: Props & { key?: Key; ref?: Ref<Api> }, slot?: SlotContent) => void;
```

`SlotContent` is `(() => void) | string` — a string slot renders as a text node.

When `Props` is `void` (no props) or all its fields are optional, the returned function can be called with no arguments:

```ts
const App = view((ctx) => ({
  render() { /* ... */ },
}));

App(); // no args needed
```

## ViewFn and context

The function passed to `view()` receives a **context object** (`ctx`) with four fields:

```ts
const MyComponent = view<{ title: string }>((ctx) => {
  // ctx.props -- function that returns the current props object
  // ctx.use   -- factory to create reactive state or subscribe to stores
  // ctx.slot  -- renders the children passed by the caller
  // ctx.ref   -- publishes an API object into the consumer's `ref`

  return {
    render() { /* ... */ },
  };
});
```

### ctx.props

A function that returns the current props passed by the parent. Call `ctx.props()` to read:

```ts
const Label = view<{ text: string }>((ctx) => ({
  render() {
    span(_, ctx.props().text);
  },
}));
```

Because `props` is a function, calling it always returns the latest values -- whether inside `render()`, lifecycle hooks, or event handlers:

```ts
const Good = view<{ title: string }>((ctx) => ({
  render() { text(ctx.props().title); }, // always current
}));
```

### ctx.use

A factory function to create reactive state or subscribe to stores. See [State](#/state) and [Store](#/store).

```ts
const count = ctx.use(0);            // Reactive<number> — local state
const items = ctx.use<string[]>([]); // Reactive<string[]> — local state
const theme = ctx.use(ThemeStore);   // Reactive<string> — store subscription
```

### ctx.slot

A function that renders the children passed by the caller's slot. Call `ctx.slot()` inside `render()`, or pass it directly as a primitive's second argument:

```ts
const Wrapper = view((ctx) => ({
  render() {
    div({ class: "wrapper" }, ctx.slot);
  },
}));
```

If the caller provided no slot, `ctx.slot()` renders nothing.

### ctx.ref

Publishes an API object into the consumer's `ref` prop. See "Exposing an API via `ref`" below.

## ViewBody

The viewFn must return a `ViewBody` object. The only required field is `render`:

```ts
type ViewBody<Props> = {
  render: () => void;
  onMount?: () => void;
  shouldUpdate?: (nextProps: Props) => boolean;
  onUpdateBefore?: () => void;
  onUpdateAfter?: () => void;
  dispose?: () => void;
};
```

The `Api` type parameter is not part of ViewBody — a view publishes its API by calling `ctx.ref(...)`. See "Exposing an API via `ref`" below.

### render()

Called on every render cycle. Inside `render()`, call primitives and child components imperatively. The order of calls defines the virtual DOM structure:

```ts
render() {
  div({ class: "header" }, () => {
    h1(_, "Title");
  });
  div({ class: "body" }, () => {
    text("Content");
  });
}
```

All standard JavaScript control flow works inside render:

```ts
render() {
  if (isEditing.get()) {
    input({ value: draft.get(), on: { input: handleInput } });
  } else {
    span(_, () => { text(value.get()); });
  }

  for (const item of items.get()) {
    ListItem({ key: item.id, data: item });
  }
}
```

### Lifecycle hooks

See [Lifecycle](#/lifecycle) for details on `onMount`, `shouldUpdate`, `onUpdateBefore`, `onUpdateAfter`, and `dispose`.

## Calling components

Components are called as functions. The first argument is props, the second is an optional slot:

```ts
// No props, no children
MyComponent();

// With props
Counter({ initial: 5 });

// With children (slot)
Card(_, () => {
  text("Inside the card");
});

// With props and children
Section({ title: "Info" }, () => {
  Paragraph({ text: "Details here" });
});
```

### Keys

Pass `key` in the props object to help reconciliation identify items across re-renders:

```ts
for (const user of users.get()) {
  UserCard({ key: user.id, name: user.name });
}
```

## Exposing an API via `ref`

Both primitives and composite views accept a `ref` prop on the call site, and
both fill it through the same `Ref<T>` machinery. The difference is on the
provider side: the renderer pushes the DOM `Element` into a primitive's ref;
inside a composite, you push an API object yourself by calling `ctx.ref(...)`.

```ts
import { view, input, type RefObject } from "creo";

const TextInput = view<{ placeholder: string }, { focus: () => void }>(
  ({ props, ref }) => {
    const inputRef: RefObject<HTMLInputElement> = { current: null };
    ref({
      focus: () => inputRef.current?.focus(),
    });
    return {
      render() {
        input({ placeholder: props().placeholder, ref: inputRef });
      },
    };
  },
);

// Consumer:
const myInput: RefObject<{ focus: () => void }> = { current: null };
TextInput({ placeholder: "Email", ref: myInput });
// After mount:
myInput.current?.focus();
```

`ref` works the same on primitives — `div({ ref })` populates `.current` (or
fires the callback) with the underlying `Element` after mount, and `null` on
unmount. The provider verb is `ctx.ref(...)` on a composite; the consumer
noun is `ref` in props on either side.
