// Anchor coordination between hash-based routing and heading anchors.
//
// The router (creo-router) treats everything after the first `#` as the path.
// But we want deep-linkable heading anchors, e.g.
//     /#/getting-started#installation
// The secondary `#installation` would otherwise make the router match no
// route. To avoid that:
//
//   1. Before the router boots, we strip the secondary `#...` from the URL
//      and remember it in `pendingAnchor`. The router then only sees
//      `/getting-started`.
//   2. After the route mounts, DocPage calls `consumePendingAnchor()` to get
//      the id, scrolls to it, and writes the full URL back via
//      `history.replaceState` — which does NOT fire `hashchange`, so the
//      router stays on the correct route while the user sees and can copy
//      a URL that includes the anchor.
//   3. Heading-anchor clicks go through `scrollToAnchor()` which also uses
//      `replaceState` for the same reason.

let pendingAnchor: string | null = null;

// Run immediately at module import (before router creates).
{
  // Take control of scroll position on reload so the browser's automatic
  // scroll restoration doesn't fight the pending-anchor scroll.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const hash = window.location.hash;
  const second = hash.indexOf("#", 1);
  if (second > 0) {
    pendingAnchor = hash.slice(second + 1);
    history.replaceState(null, "", hash.slice(0, second) + location.search);
  }
}

export function consumePendingAnchor(): string | null {
  const v = pendingAnchor;
  pendingAnchor = null;
  return v;
}

export function scrollToAnchor(id: string, smooth = true): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  // Preserve the current route hash, append the anchor. replaceState does
  // not trigger hashchange, so the router stays put.
  const routeHash = location.hash.split("#")[1] ?? "";
  const next = `#${routeHash}#${id}`;
  history.replaceState(null, "", next);
}
