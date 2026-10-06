// Strips a secondary `#anchor` before the router reads the hash; restored via
// replaceState (no hashchange) once the route mounts.

let pendingAnchor: string | null = null;

{
  // Keep browser scroll restoration from fighting the anchor scroll
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
  // replaceState: no hashchange, so the router stays put
  const routeHash = location.hash.split("#")[1] ?? "";
  const next = `#${routeHash}#${id}`;
  history.replaceState(null, "", next);
}
