# Router

Creo ships a separate package, [`creo-router`](https://www.npmjs.com/package/creo-router), that provides a minimal hash-based router built on top of the `store` primitive. It weighs a few hundred bytes gzipped.

## Install

```bash
bun add creo creo-router
```

## Setup

`createRouter` takes a list of routes and a fallback, and returns a bundle of tools: a route store, a `navigate` helper, a `RouterView` to render the matched view, and a `Link` that intercepts clicks.

```ts
import { createRouter } from "creo-router";

const { routeStore, navigate, RouterView, Link } = createRouter({
  routes: [
    { path: "/", view: () => HomePage() },
    { path: "/about", view: () => AboutPage() },
    { path: "/users/:id", view: () => UserPage() },
  ],
  fallback: () => NotFoundPage(),
});
```

Routes support:

- Static segments: `/about`
- Dynamic params: `/users/:id`, read via `route.params.id`

## Rendering

Mount `RouterView()` wherever you want route content to appear — typically inside a layout view.

```ts
import { _ } from "creo";

const App = view(() => ({
  render() {
    div({ class: "shell" }, () => {
      nav(_, () => {
        Link({ href: "/" }, "Home");
        Link({ href: "/about" }, "About");
      });
      main(_, () => {
        RouterView();
      });
    });
  },
}));
```

## Reading route params

`routeStore` is a regular Creo store. Subscribe from any view with `use(routeStore)`:

```ts
const UserPage = view(({ use }) => {
  const route = use(routeStore);

  return {
    render() {
      const { id } = route.get().params;
      h1(_, `User ${id}`);
    },
  };
});
```

## Programmatic navigation

`navigate(path)` updates the hash — the store reacts automatically, and any view subscribed to it re-renders.

```ts
const handleSave = async () => {
  await api.save(form);
  navigate("/success");
};
```

## Handling the back button

The browser's back/forward buttons fire `hashchange`, which the router listens to. No extra work needed.

## Active link styling

Since `Link` just renders an `<a>`, you can compare against `routeStore` to style it:

```ts
const NavLink = view<{ href: string }>(({ props, use, slot }) => {
  const route = use(routeStore);

  return {
    render() {
      const p = props();
      const active = route.get().path === p.href;
      Link(
        { href: p.href, class: active ? "nav-link active" : "nav-link" },
        slot,
      );
    },
  };
});
```

## Notes

- The router is **hash-based** (`#/path`). This means no server config is required — works on GitHub Pages, static hosts, and `file://` out of the box.
- All route changes go through the store, so they integrate with Creo's scheduler: a single render pass handles the route change and any state updates triggered by it.
