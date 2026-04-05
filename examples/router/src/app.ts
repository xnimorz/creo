import { view } from "@/public/view";
import { _ } from "@/functional/maybe";
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
    h1(_, "Home");
    p(_, "Welcome to the Creo Router example app.");
    p(_, "Use the navigation above to browse pages. Try the Users section to see dynamic route params in action.");
  },
}));

const AboutPage = view(() => ({
  render() {
    h1(_, "About");
    p(_, "This example demonstrates creo-router — a lightweight, store-based hash router for the Creo UI framework.");
    p(_, "Features:");
    ul(_, () => {
      li(_, "Hash-based navigation (#/path)");
      li(_, "Dynamic route parameters (/users/:id)");
      li(_, "Store-driven reactivity — views re-render on route change");
      li(_, "Link component with click interception");
      li(_, "Programmatic navigation via navigate()");
      li(_, "Browser back/forward support");
    });
  },
}));

const NotFoundPage = view(() => ({
  render() {
    div({ class: "not-found" }, () => {
      h1(_, "404");
      p(_, "Page not found.");
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
    h1(_, "Users");
    p(_, "Click a user to view their profile:");
    ul({ class: "user-list" }, () => {
      for (const user of users) {
        li({ key: user.id }, () => {
          Link({ href: `/users/${user.id}` }, user.name);
          span(_, ` — ${user.role}`);
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
        h1(_, "User not found");
        p(_, `No user with ID "${id}".`);
        Link({ href: "/users", class: "back-link" }, "← Back to users");
        return;
      }

      h2(_, user.name);
      dl({ class: "profile-card" }, () => {
        dt(_, "ID");
        dd(_, String(user.id));
        dt(_, "Name");
        dd(_, user.name);
        dt(_, "Role");
        dd(_, user.role);
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
