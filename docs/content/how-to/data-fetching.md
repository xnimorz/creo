# Data Fetching

Creo has no built-in data-fetching library. The state primitive (`use()`) is enough — it supports async updates, and render reads the current value synchronously.

## The basic pattern

Track three things: the data, a loading flag, and an error.

```ts
const UserProfile = view<{ id: string }>(({ props, use }) => {
  const user = use<User | null>(null);
  const loading = use(false);
  const error = use<string | null>(null);

  const load = async () => {
    loading.set(true);
    error.set(null);
    try {
      const res = await fetch(`/api/users/${props().id}`);
      if (!res.ok) throw new Error(res.statusText);
      user.set(await res.json());
    } catch (e) {
      error.set((e as Error).message);
    } finally {
      loading.set(false);
    }
  };

  return {
    onMount: load,
    render() {
      if (loading.get()) return Spinner();
      if (error.get()) return ErrorBanner({ message: error.get()! });
      const u = user.get();
      if (!u) return null;
      UserCard({ user: u });
    },
  };
});
```

## Using `update()` with async

`update()` accepts an async function and chains through pending updates safely:

```ts
const refresh = () => user.update(async (current) => {
  const fresh = await api.getUser(current.id);
  return fresh;
});
```

## Refetching on prop change

Use `shouldUpdate` combined with `onUpdateAfter` to refetch when a prop changes:

```ts
const UserProfile = view<{ id: string }>(({ props, use }) => {
  let lastId = props().id;
  const user = use<User | null>(null);

  const load = async (id: string) => {
    user.set(await api.getUser(id));
  };

  return {
    onMount: () => load(lastId),
    onUpdateAfter() {
      if (props().id !== lastId) {
        lastId = props().id;
        load(lastId);
      }
    },
    render() { /* ... */ },
  };
});
```

## Sharing data across views

For data used by many views, put it in a `store`. Views subscribe with `use(store)` and all re-render when the data updates.

```ts
import { store } from "creo";

type UsersState = {
  byId: Record<string, User>;
  loading: Set<string>;
};

const UsersStore = store.new<UsersState>({ byId: {}, loading: new Set() });

export async function loadUser(id: string) {
  const state = UsersStore.get();
  if (state.byId[id] || state.loading.has(id)) return;

  UsersStore.update((s) => ({
    ...s,
    loading: new Set([...s.loading, id]),
  }));

  const user = await api.getUser(id);

  UsersStore.update((s) => {
    const loading = new Set(s.loading);
    loading.delete(id);
    return {
      byId: { ...s.byId, [id]: user },
      loading,
    };
  });
}
```

Any view can now do `use(UsersStore)` and read `state.byId[id]` synchronously.

## Cancellation

For requests that may outlive the view (e.g., user navigates away), use an `AbortController`:

```ts
const list = use<Item[]>([]);
let controller: AbortController | null = null;

const load = async () => {
  controller?.abort();
  controller = new AbortController();
  try {
    const res = await fetch("/api/items", { signal: controller.signal });
    list.set(await res.json());
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw e;
  }
};
```

## Avoiding waterfalls

If two requests don't depend on each other, kick them off in parallel:

```ts
const load = async () => {
  const [u, posts] = await Promise.all([
    api.getUser(id),
    api.getPosts(id),
  ]);
  user.set(u);
  postList.set(posts);
};
```

## See also

- [Suspense pattern](#/how-to/suspense) — a helper view that wraps the loading/error/data dance into one component.
