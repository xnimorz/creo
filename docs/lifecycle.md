# Lifecycle

Creo provides explicit, named lifecycle hooks on the `ViewBody` object. There are no dependency arrays -- each hook has a clear purpose and timing.

## Overview

| Hook | When it runs |
|------|-------------|
| `mount.before` | Before the first render of the view |
| `mount.after` | After the first render and all children have mounted |
| `update.should` | Before a re-render, to decide if it should proceed |
| `update.before` | Before each re-render (not called on first render) |
| `update.after` | After each re-render (not called on first render) |
| Disposal (`Symbol.dispose`) | When the view is removed from the tree |

## mount

### mount.before

Runs synchronously before the view's first render. The DOM/output does not exist yet. Use it for setup that must happen before the view appears:

```ts
const Timer = view(({ use }) => {
  const elapsed = use(0);
  let startTime = 0;

  return {
    mount: {
      before() {
        startTime = Date.now();
      },
    },
    render() {
      text(`${elapsed.get()}ms`);
    },
  };
});
```

### mount.after

Runs after the view's first render and after all children have been rendered. The DOM/output exists at this point. Use it for post-mount side effects like focusing an element, starting timers, or fetching data:

```ts
const AutoFocus = view(({ use }) => {
  const data = use<string[]>([]);

  return {
    mount: {
      after() {
        // DOM is ready, children are mounted
        fetch("/api/items")
          .then(r => r.json())
          .then(items => data.set(items));
      },
    },
    render() {
      for (const item of data.get()) {
        li({}, () => { text(item); });
      }
    },
  };
});
```

`mount.after` callbacks are batched -- all views that mounted in the same render loop have their `mount.after` called after the entire tree is settled.

## update

### update.should

A predicate that decides whether the view should re-render when it receives new props. Return `true` to allow the render, `false` to skip it. This is equivalent to `React.memo`'s comparison function:

```ts
const ExpensiveList = view<{ items: string[]; label: string }>(({ props }) => {
  return {
    update: {
      should(nextProps) {
        // Only re-render if items actually changed
        return nextProps.items !== props().items;
      },
    },
    render() {
      div({}, () => {
        text(props().label);
        for (const item of props().items) {
          li({}, () => { text(item); });
        }
      });
    },
  };
});
```

If `update.should` is not defined, Creo uses shallow equality comparison on props by default.

### update.before

Runs synchronously before each re-render (not on the first render). Use it for pre-render calculations or logging:

```ts
const Animated = view(({ use }) => {
  const value = use(0);
  let prevValue = 0;

  return {
    update: {
      before() {
        prevValue = value.get();
      },
    },
    render() {
      div({ class: prevValue !== value.get() ? "changed" : "" }, () => {
        text(String(value.get()));
      });
    },
  };
});
```

### update.after

Runs synchronously after each re-render (not on the first render). The DOM/output reflects the new state:

```ts
const ScrollToBottom = view(({ use }) => {
  const messages = use<string[]>([]);

  return {
    update: {
      after() {
        // Scroll container to bottom after new messages render
        const el = document.getElementById("messages");
        if (el) el.scrollTop = el.scrollHeight;
      },
    },
    render() {
      div({ id: "messages" }, () => {
        for (const msg of messages.get()) {
          p({}, () => { text(msg); });
        }
      });
    },
  };
});
```

## Disposal

When a view is removed from the tree (its parent no longer renders it), the view and all its descendants are disposed. The engine calls `renderer.unmount(view)` to clean up output artifacts and removes the view from the dirty queue.

Disposal happens automatically during reconciliation. If you need cleanup logic (clearing timers, cancelling subscriptions), use a variable in the view function body and clean it up in `mount.after` or by structuring your code so resources are tied to state:

```ts
const Poller = view(({ use }) => {
  const data = use("");
  let intervalId: number | undefined;

  return {
    mount: {
      after() {
        intervalId = setInterval(() => {
          fetch("/api/status")
            .then(r => r.text())
            .then(t => data.set(t));
        }, 5000);
      },
    },
    render() {
      text(data.get());
    },
  };
});
```

Note: Creo views implement the `Disposable` interface (`Symbol.dispose`), enabling use with TypeScript's `using` declarations in contexts where manual disposal is needed.

## Complete example

```ts
const Dashboard = view<{ userId: string }>(({ props, use }) => {
  const profile = use<{ name: string } | null>(null);
  const renderCount = { value: 0 };

  return {
    mount: {
      before() {
        console.log("Dashboard mounting for user:", props().userId);
      },
      after() {
        fetch(`/api/users/${props().userId}`)
          .then(r => r.json())
          .then(data => profile.set(data));
      },
    },
    update: {
      should(nextProps) {
        return nextProps.userId !== props().userId;
      },
      before() {
        renderCount.value++;
        console.log(`Re-render #${renderCount.value}`);
      },
      after() {
        console.log("Dashboard updated");
      },
    },
    render() {
      div({ class: "dashboard" }, () => {
        if (profile.get()) {
          h1({}, () => { text(profile.get()!.name); });
        } else {
          text("Loading...");
        }
      });
    },
  };
});
```
