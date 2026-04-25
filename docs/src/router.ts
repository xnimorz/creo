import { createRouter } from "creo-router";
import { view } from "creo";
import { docs } from "virtual:docs-index";
import { Landing } from "./views/Landing";
import { NotFound } from "./views/NotFound";
import { DocPage } from "./views/DocPage";
import { Playground } from "./views/Playground";
import { navSections } from "./nav";

const DocRoute = view<{ slug: string }>(({ props }) => ({
  render() {
    const slug = props().slug;
    const doc = docs[slug];
    if (!doc) {
      NotFound();
      return;
    }
    DocPage({ doc, slug });
  },
}));

// Collect every routable slug: everything in the nav plus whatever raw md exists
const slugs = new Set<string>();
for (const s of navSections) for (const i of s.items) slugs.add(i.slug);
for (const k of Object.keys(docs)) slugs.add(k);

const routes: { path: string; view: () => void }[] = [
  { path: "/", view: () => Landing() },
  { path: "/playground", view: () => Playground() },
];

for (const slug of slugs) {
  if (!slug) continue;
  if (slug === "playground") continue;
  routes.push({ path: "/" + slug, view: () => DocRoute({ slug }) });
}

export const { routeStore, navigate, RouterView, Link } = createRouter({
  routes,
  fallback: () => NotFound(),
});
