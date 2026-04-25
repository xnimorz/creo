export type NavItem = { title: string; slug: string };
export type NavSection = { title: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    title: "Introduction",
    items: [
      { title: "Overview", slug: "" },
      { title: "Getting Started", slug: "getting-started" },
      { title: "Create App", slug: "create-app" },
    ],
  },
  {
    title: "Guide",
    items: [
      { title: "View", slug: "view" },
      { title: "State", slug: "state" },
      { title: "Store", slug: "store" },
      { title: "Events", slug: "events" },
      { title: "Lifecycle", slug: "lifecycle" },
      { title: "Primitives", slug: "primitives" },
      { title: "Renderers", slug: "renderers" },
    ],
  },
  {
    title: "How-to",
    items: [
      { title: "Router", slug: "how-to/router" },
      { title: "Data Fetching", slug: "how-to/data-fetching" },
      { title: "Styles", slug: "how-to/styles" },
      { title: "Suspense Pattern", slug: "how-to/suspense" },
      { title: "Deploy to Vercel", slug: "how-to/deploy-vercel" },
    ],
  },
  {
    title: "Playground",
    items: [{ title: "Try Creo", slug: "playground" }],
  },
];

export function findNavItem(slug: string): NavItem | null {
  for (const s of navSections) {
    for (const i of s.items) if (i.slug === slug) return i;
  }
  return null;
}

export function prevNext(slug: string): { prev: NavItem | null; next: NavItem | null } {
  const flat: NavItem[] = navSections.flatMap((s) => s.items);
  const i = flat.findIndex((x) => x.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? flat[i - 1] : null,
    next: i < flat.length - 1 ? flat[i + 1] : null,
  };
}
