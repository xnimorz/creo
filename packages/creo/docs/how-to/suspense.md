# Suspense Pattern

Creo has no `<Suspense>` primitive and doesn't need one — you can compose the same behavior from a plain view. The goal: take an async loader, show a fallback while it runs, and render the data on success.

## A reusable `Suspense` view

```ts
import { view, div, _ } from "creo";
import type { SlotContent } from "creo";

type SuspenseProps<T> = {
  load: () => Promise<T>;
  children: (data: T) => void;
  fallback?: SlotContent;
  error?: (err: Error) => void;
  key?: unknown; // pass a key to force reload when dependencies change
};

export const Suspense = view(<T,>({ props, use }: any) => {
  type Status = "loading" | "ok" | "error";
  const status = use<Status>("loading");
  const data = use<T | null>(null);
  const err = use<Error | null>(null);

  const run = async () => {
    status.set("loading");
    try {
      const result = await props().load();
      data.set(result);
      status.set("ok");
    } catch (e) {
      err.set(e as Error);
      status.set("error");
    }
  };

  return {
    onMount: run,
    render() {
      const p = props();
      switch (status.get()) {
        case "loading":
          if (p.fallback) {
            if (typeof p.fallback === "string") {
              div({ class: "suspense-fallback" }, p.fallback);
            } else {
              p.fallback();
            }
          } else {
            div({ class: "suspense-fallback" }, "Loading...");
          }
          return;
        case "error":
          if (p.error) p.error(err.get()!);
          else div({ class: "suspense-error" }, err.get()!.message);
          return;
        case "ok":
          p.children(data.get()!);
          return;
      }
    },
  };
});
```

## Usage

```ts
const UserProfile = view<{ id: string }>(({ props }) => ({
  render() {
    Suspense({
      key: props().id, // re-mount when id changes
      load: () => fetch(`/api/users/${props().id}`).then(r => r.json()),
      fallback: () => Spinner(),
      error: (e) => ErrorBanner({ message: e.message }),
      children: (user: User) => {
        h1(_, user.name);
        p(_, user.bio);
      },
    });
  },
}));
```

## Why this is different from React Suspense

React's `<Suspense>` hooks into a special "throw a promise" protocol baked into the renderer. Creo keeps the model simpler: the async work happens in a view's lifecycle, and the status is ordinary state. You get:

- No special reconciler support needed.
- Full control over loading/error UI without wrapper gymnastics.
- No "use this hook only under a boundary" gotchas.

## Composing with `store`

If many views depend on the same resource, move the loading logic into a store and subscribe:

```ts
const user = use(UsersStore);
const loaded = user.get().byId[id];

if (!loaded) {
  Spinner();
  loadUser(id); // idempotent — checks in-flight set
  return;
}

UserCard({ user: loaded });
```

Then `Suspense` is only useful for one-off async work — anything reused goes into a store.

## Caveats

- Don't call the `load` function from `render()` — it would fire a new request every re-render. Put it in `onMount()`.
- For cancellation, pair with `AbortController` (see [data fetching](#/how-to/data-fetching)).
- If `load` throws synchronously, the error path still works — `await` converts synchronous throws into a rejected promise.
