import { view } from "@/public/view";
import { div, text, nav, h1, h2, p, ul, li, dl, dt, dd, span, button } from "@/public/primitives/primitives";
import { createRouter } from "creo-router";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const users = [
  { id: 1, name: "Alice Johnson", role: "Engineer" },
  { id: 2, name: "Bob Smith", role: "Designer" },
  { id: 3, name: "Carol Williams", role: "Product Manager" },
  { id: 4, name: "Dave Brown", role: "Data Scientist" },
];

// ---------------------------------------------------------------------------
// Pages (no router dependencies)
// ---------------------------------------------------------------------------

const HomePage = view(() => ({
  render() {
    h1({}, "Home");
    p({}, "Welcome to the Creo Router example app.");
    p({}, "Use the navigation above to browse pages. Try the Users section to see dynamic route params in action.");
  },
}));

const AboutPage = view(() => ({
  render() {
    h1({}, "About");
    p({}, "This example demonstrates creo-router — a lightweight, store-based hash router for the Creo UI framework.");
    p({}, "Features:");
    ul({}, () => {
      li({}, "Hash-based navigation (#/path)");
      li({}, "Dynamic route parameters (/users/:id)");
      li({}, "Store-driven reactivity — views re-render on route change");
      li({}, "Link component with click interception");
      li({}, "Programmatic navigation via navigate()");
      li({}, "Browser back/forward support");
    });
  },
}));

const NotFoundPage = view(() => ({
  render() {
    div({ class: "not-found" }, () => {
      h1({}, "404");
      p({}, "Page not found.");
    });
  },
}));

// ---------------------------------------------------------------------------
// Router setup
// ---------------------------------------------------------------------------

const { routeStore, navigate, RouterView, Link } = createRouter({
  routes: [
    { path: "/", view: () => HomePage() },
    { path: "/about", view: () => AboutPage() },
    { path: "/users", view: () => UsersPage() },
    { path: "/users/:id", view: () => UserPage() },
  ],
  fallback: () => NotFoundPage(),
});

// ---------------------------------------------------------------------------
// Pages (with router dependencies)
// ---------------------------------------------------------------------------

const UsersPage = view(() => ({
  render() {
    h1({}, "Users");
    p({}, "Click a user to view their profile:");
    ul({ class: "user-list" }, () => {
      for (const user of users) {
        li({ key: user.id }, () => {
          Link({ href: `/users/${user.id}` }, user.name);
          span({}, ` — ${user.role}`);
        });
      }
    });
  },
}));

const UserPage = view(({ use }) => {
  const route = use(routeStore);

  const handleBack = () => navigate("/users");

  return {
    render() {
      const { id } = route.get().params;
      const user = users.find((u) => u.id === Number(id));

      if (!user) {
        h1({}, "User not found");
        p({}, `No user with ID "${id}".`);
        Link({ href: "/users", class: "back-link" }, "← Back to users");
        return;
      }

      h2({}, user.name);
      dl({ class: "profile-card" }, () => {
        dt({}, "ID");
        dd({}, String(user.id));
        dt({}, "Name");
        dd({}, user.name);
        dt({}, "Role");
        dd({}, user.role);
      });

      Link({ href: "/users", class: "back-link" }, "← Back to users");
    },
  };
});

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

export const App = view(({ use }) => {
  const route = use(routeStore);

  return {
    render() {
      const currentPath = route.get().path;

      div({ class: "shell" }, () => {
        nav({ class: "nav" }, () => {
          Link({ href: "/", class: currentPath === "/" ? "active" : undefined }, "Home");
          Link({ href: "/about", class: currentPath === "/about" ? "active" : undefined }, "About");
          Link({ href: "/users", class: currentPath.startsWith("/users") ? "active" : undefined }, "Users");
        });

        div({ class: "content" }, () => {
          RouterView();
        });
      });
    },
  };
});
