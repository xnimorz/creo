# Lifecycle

Creo provides explicit, named lifecycle hooks on the `ViewBody` object. There are no dependency arrays — each hook has a clear purpose and timing.

## Overview

| Hook | When it runs |
|------|-------------|
| `onMount` | After the view's first render (DOM/output exists) |
| `shouldUpdate(nextProps)` | Before a re-render, to decide whether it should proceed |
| `onUpdateBefore` | Before each re-render (not called on first render) |
| `onUpdateAfter` | After each re-render (not called on first render) |

All hooks are optional properties on the object returned from a view function.

## onMount

Runs after the view's first render and after all children have been rendered. The DOM/output exists at this point. Use it for post-mount side effects like focusing an element, starting timers, or fetching data:

```ts
const ItemList = view(({ use }) => {
  const data = use<string[]>([]);

  return {
    onMount() {
      fetch("/api/items")
        .then(r => r.json())
        .then(items => data.set(items));
    },
    render() {
      for (const item of data.get()) {
        li(_, item);
      }
    },
  };
});
```

`onMount` callbacks are batched — all views that mounted in the same render loop have their `onMount` called after the entire tree is settled.

## shouldUpdate

A predicate that decides whether the view should re-render when it receives new props. Return `true` to allow the render, `false` to skip it. This is equivalent to `React.memo`'s comparison function:

```ts
const ExpensiveList = view<{ items: string[]; label: string }>(({ props }) => {
  return {
    shouldUpdate(nextProps) {
      return nextProps.items !== props().items;
    },
    render() {
      div(_, () => {
        text(props().label);
        for (const item of props().items) {
          li(_, item);
        }
      });
    },
  };
});
```

If `shouldUpdate` is not defined, Creo compares props by **shallow equality**. The view re-renders when its own props shallow-differ, when a subscribed `use()` value changes, or when the slot's structure changes — a parent re-render alone doesn't force a child re-render.

## onUpdateBefore

Runs synchronously before each re-render (not on the first render). Use it for pre-render calculations or logging:

```ts
const Animated = view(({ use }) => {
  const value = use(0);
  let prevValue = 0;

  return {
    onUpdateBefore() {
      prevValue = value.get();
    },
    render() {
      div({ class: prevValue !== value.get() ? "changed" : "" }, () => {
        text(String(value.get()));
      });
    },
  };
});
```

## onUpdateAfter

Runs synchronously after each re-render (not on the first render). The DOM/output reflects the new state:

```ts
const WordCount = view<{ text: string }>(({ props, use }) => {
  const count = use(0);

  return {
    onUpdateAfter() {
      // Props just changed; derive a value from them and push it somewhere.
      count.set(props().text.trim().split(/\s+/).filter(Boolean).length);
      console.log(`re-rendered with ${count.get()} words`);
    },
    render() {
      div(_, () => {
        p(_, props().text);
        p({ class: "meta" }, `${count.get()} words`);
      });
    },
  };
});
```

`onUpdateAfter` is for observing the result of a render — reading measurements, pushing metrics, scheduling follow-up work. It fires after DOM mutations are applied, so any reads you do see the latest layout.

## Cleanup

When a view is removed from the tree (its parent no longer renders it), the view and all its descendants are disposed automatically during reconciliation. The engine calls the renderer's `unmount` to clean up output artifacts and removes the view from the dirty queue.

There is no dedicated unmount hook. For cleanup of resources (timers, subscriptions, event listeners) started in `onMount`, tie them to module-scoped stores or rely on `setInterval`/`setTimeout` completing on page unload. If you need guaranteed teardown, pair the resource with a reactive `store` and clear it from a parent view when the child is conditionally removed.

```ts
const Poller = view(({ use }) => {
  const data = use("");

  return {
    onMount() {
      setInterval(() => {
        fetch("/api/status")
          .then(r => r.text())
          .then(t => data.set(t));
      }, 5000);
    },
    render() {
      text(data.get());
    },
  };
});
```

## Complete example

```ts
const Dashboard = view<{ userId: string }>(({ props, use }) => {
  const profile = use<{ name: string } | null>(null);
  let renderCount = 0;

  return {
    onMount() {
      fetch(`/api/users/${props().userId}`)
        .then(r => r.json())
        .then(data => profile.set(data));
    },
    shouldUpdate(nextProps) {
      return nextProps.userId !== props().userId;
    },
    onUpdateBefore() {
      renderCount++;
      console.log(`Re-render #${renderCount}`);
    },
    onUpdateAfter() {
      console.log("Dashboard updated");
    },
    render() {
      div({ class: "dashboard" }, () => {
        const p = profile.get();
        if (p) {
          h1(_, p.name);
        } else {
          text("Loading...");
        }
      });
    },
  };
});
```
