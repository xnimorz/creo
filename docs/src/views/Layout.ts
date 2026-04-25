import { view, div, header, nav, aside, main, a, ul, li, span, button, _ } from "creo";
import { navSections } from "../nav";
import { routeStore } from "../router";

function isDocRoute(slug: string): boolean {
  return slug !== "" && slug !== "playground";
}

export const Layout = view(({ slot, use }) => {
  const route = use(routeStore);
  const mobileOpen = use(false);

  const toggleMobile = () => mobileOpen.update((v) => !v);
  const closeMobile = () => mobileOpen.set(false);

  return {
    render() {
      const currentSlug = route.get().path.replace(/^\/+/, "");
      const docShell = isDocRoute(currentSlug);

      // NOTE: structure is intentionally stable across routes. Sidebar + body
      // frame are toggled via CSS classes rather than conditional rendering, so
      // the slot (RouterView) is never wrapped by a primitive that gets
      // disposed on route transitions.
      const layoutClass =
        "layout" +
        (mobileOpen.get() ? " nav-open" : "") +
        (docShell ? " layout-docs" : " layout-full");

      div({ class: layoutClass }, () => {
        header({ class: "site-header" }, () => {
          div({ class: "header-inner" }, () => {
            a({ href: "#/", class: "brand", "aria-label": "creo" }, () => {
              span({ class: "brand-wordmark" }, () => {
                span({ class: "brand-bracket" }, "[");
                span({ class: "brand-c" }, "C");
                span({ class: "brand-tail" }, "reo");
                span({ class: "brand-bracket" }, "]");
              });
            });

            nav({ class: "header-nav" }, () => {
              a({ href: "#/getting-started" }, "Docs");
              a({ href: "#/playground" }, "Playground");
              a({ href: "https://github.com/xnimorz/creo", target: "_blank" }, "GitHub");
            });

            button(
              {
                class: "mobile-toggle",
                onClick: toggleMobile,
                "aria-label": "Toggle navigation",
              },
              () => {
                span({ class: "mobile-toggle-bar" });
                span({ class: "mobile-toggle-bar" });
                span({ class: "mobile-toggle-bar" });
              },
            );
          });
        });

        div({ class: "body-shell" }, () => {
          aside({ class: "sidebar" }, () => {
            for (const section of navSections) {
              div({ key: section.title, class: "nav-section" }, () => {
                div({ class: "nav-section-title" }, section.title);
                ul({ class: "nav-list" }, () => {
                  for (const item of section.items) {
                    const isActive = currentSlug === item.slug;
                    li({ key: item.slug }, () => {
                      a(
                        {
                          href: `#/${item.slug}`,
                          class: "nav-link" + (isActive ? " active" : ""),
                          onClick: closeMobile,
                        },
                        item.title,
                      );
                    });
                  }
                });
              });
            }
          });

          main({ class: "content" }, slot);
        });
      });
    },
  };
});
