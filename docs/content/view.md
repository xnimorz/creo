# view()

`view()` is the core API for defining components in Creo.

## Signature

```ts
function view<Props = void, Api = void>(
  viewFn: ViewFn<Props, Api>
): (props: Props & { key?: Key }, slot?: Slot) => void;
```

When `Props` is `void` (no props), the returned function can be called with no arguments:

```ts
const App = view((ctx) => ({
  render() { /* ... */ },
}));

App(); // no args needed
```

## ViewFn and context

The function passed to `view()` receives a **context object** (`ctx`) with three fields:

```ts
const MyComponent = view<{ title: string }>((ctx) => {
  // ctx.props    -- function that returns the current props object
  // ctx.use      -- factory to create reactive state or subscribe to stores
  // ctx.children -- pre-collected PendingView[] from the parent slot

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
    span({}, () => { text(ctx.props().text); });
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

A factory function to create reactive state or subscribe to stores. See [State](./state.md) and [Store](./store.md).

```ts
const count = ctx.use(0);            // Reactive<number> — local state
const items = ctx.use<string[]>([]); // Reactive<string[]> — local state
const theme = ctx.use(ThemeStore);   // Reactive<string> — store subscription
```

### ctx.children

An array of `PendingView` objects representing the children passed by the caller's slot. Pass `ctx.children` directly to a primitive's second argument to render them:

```ts
const Wrapper = view((ctx) => ({
  render() {
    div({ class: "wrapper" }, ctx.children);
  },
}));
```

If the caller provided no slot, `ctx.children` is an empty array.

## ViewBody

The viewFn must return a `ViewBody` object. The only required field is `render`:

```ts
type ViewBody<Props, Api> = {
  render: () => void;
  mount?: {
    before?: () => void;
    after?: () => void;
  };
  update?: {
    should?: (nextProps: Props) => boolean;
    before?: () => void;
    after?: () => void;
  };
};
```

When `Api` is provided (not `void`), ViewBody also includes an `api` field. See [Exposing an API](#exposing-an-api) below.

### render()

Called on every render cycle. Inside `render()`, call primitives and child components imperatively. The order of calls defines the virtual DOM structure:

```ts
render() {
  div({ class: "header" }, () => {
    h1({}, () => { text("Title"); });
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
    input({ value: draft.get(), onInput: handleInput });
  } else {
    span({}, () => { text(value.get()); });
  }

  for (const item of items.get()) {
    ListItem({ key: item.id, data: item });
  }
}
```

### Lifecycle hooks

See [Lifecycle](./lifecycle.md) for details on `mount` and `update`.

## Calling components

Components are called as functions. The first argument is props, the second is an optional slot:

```ts
// No props, no children
MyComponent();

// With props
Counter({ initial: 5 });

// With children (slot)
Card({}, () => {
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

## Exposing an API

Views can expose an API object for parent components to interact with:

```ts
const TextInput = view<{ placeholder: string }, { focus: () => void }>((ctx) => {
  let inputEl: HTMLInputElement | null = null;

  return {
    render() {
      input({ placeholder: ctx.props().placeholder });
    },
    api: {
      focus() { inputEl?.focus(); },
    },
  };
});
```

When `Api` is not `void`, the ViewBody must include an `api` field.
