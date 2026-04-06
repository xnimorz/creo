# creo-router

Hash-based router for [Creo](../../README.md). Store-driven, zero dependencies beyond creo itself.

## Install

```bash
bun add creo-router
```

Peer dependency: `creo`

## Usage

```ts
import { createRouter } from "creo-router";

const { routeStore, navigate, RouterView, Link } = createRouter({
  routes: [
    { path: "/", view: () => HomePage() },
    { path: "/about", view: () => AboutPage() },
    { path: "/users", view: () => UsersPage() },
    { path: "/users/:id", view: () => UserPage() },
  ],
  fallback: () => NotFoundPage(),
});
```

`createRouter` returns four things:

| Export | Type | Description |
|--------|------|-------------|
| `routeStore` | `Store<Route>` | Reactive store holding the current route. Subscribe with `use(routeStore)`. |
| `navigate` | `(path: string) => void` | Programmatic navigation. Sets `location.hash`. |
| `RouterView` | View component | Renders the matched route's view. Place it where page content should appear. |
| `Link` | View component | Renders an `<a>` tag with click interception for SPA navigation. |

## RouterView

Subscribes to `routeStore` and renders the matched view on every route change.

```ts
// In your app's render:
div({ class: "content" }, () => {
  RouterView();
});
```

## Link

Renders an `<a>` with `href="#/path"` for accessibility (right-click, hover preview) and intercepts clicks to call `navigate()` instead of full page reload.

```ts
// Props: { href: string; class?: string }
// Accepts slot for children

Link({ href: "/about" }, "About");
Link({ href: "/users/42", class: "active" }, "User 42");
```

## Route Params

Dynamic segments use `:param` syntax. Access via `routeStore`:

```ts
// Route definition:
{ path: "/users/:id", view: () => UserPage() }

// Inside UserPage:
const UserPage = view(({ use }) => {
  const route = use(routeStore);

  return {
    render() {
      const userId = route.get().params.id;  // "42"
      text(`User ${userId}`);
    },
  };
});
```

Multiple params work:

```ts
{ path: "/org/:orgId/team/:teamId", view: () => TeamPage() }
// route.get().params → { orgId: "acme", teamId: "eng" }
```

## Active Link Highlighting

Read `routeStore` to conditionally apply classes:

```ts
const App = view(({ use }) => {
  const route = use(routeStore);

  return {
    render() {
      const path = route.get().path;
      nav(_, () => {
        Link({ href: "/", class: path === "/" ? "active" : "" }, "Home");
        Link({ href: "/about", class: path === "/about" ? "active" : "" }, "About");
      });
      div({ class: "content" }, () => { RouterView(); });
    },
  };
});
```

## Fallback (404)

`fallback` is required. It renders when no route matches:

```ts
const { RouterView } = createRouter({
  routes: [...],
  fallback: () => {
    div({ class: "not-found" }, () => {
      h1(_, "404");
      p(_, "Page not found.");
    });
  },
});
```

## How It Works

- Uses `window.location.hash` for routing (`#/path`)
- Listens to `hashchange` for browser back/forward
- Routes are compiled to regexes once at creation time (first match wins)
- Route state lives in a creo `Store` — views subscribe via `use(routeStore)` and re-render on navigation
- No history API, no server configuration needed

## Types

```ts
type Route = {
  path: string;
  params: Record<string, string>;
};

type RouteDefinition = {
  path: string;
  view: () => void;
};

type RouterConfig = {
  routes: RouteDefinition[];
  fallback: () => void;
};
```

## Example

See [`examples/router/`](../../examples/router/) for a full working app with Home, About, Users list, and User profile pages with dynamic `:id` params.
