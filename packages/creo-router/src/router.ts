import { view, store, a } from "creo";
import type { Store, PointerEventData } from "creo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Route = {
  path: string;
  params: Record<string, string>;
};

export type RouteDefinition = {
  path: string;
  view: () => void;
};

export type RouterConfig = {
  routes: RouteDefinition[];
  fallback: () => void;
};

// ---------------------------------------------------------------------------
// Internal: path compilation & matching
// ---------------------------------------------------------------------------

type CompiledRoute = {
  pattern: RegExp;
  paramNames: string[];
  view: () => void;
};

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const segments = path.split("/").filter(Boolean);

  const regexParts = segments.map((seg) => {
    if (seg.startsWith(":")) {
      paramNames.push(seg.slice(1));
      return "([^/]+)";
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });

  const pattern = new RegExp(
    "^/" + regexParts.join("/") + (regexParts.length ? "/?" : "") + "$",
  );
  return { pattern, paramNames };
}

function matchRoute(
  path: string,
  routes: CompiledRoute[],
): { view: () => void; params: Record<string, string> } | null {
  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      for (let i = 0; i < route.paramNames.length; i++) {
        params[route.paramNames[i]!] = decodeURIComponent(match[i + 1]!);
      }
      return { view: route.view, params };
    }
  }
  return null;
}

function getHashPath(): string {
  const hash = window.location.hash;
  if (!hash || hash === "#" || hash === "#!") return "/";
  // Strip leading # or #!
  const raw = hash.startsWith("#!") ? hash.slice(2) : hash.slice(1);
  // Normalize: ensure leading slash, strip trailing slash (except root)
  const normalized = raw.startsWith("/") ? raw : "/" + raw;
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createRouter(config: RouterConfig) {
  // Compile routes once
  const compiled: CompiledRoute[] = config.routes.map((r) => ({
    ...compilePath(r.path),
    view: r.view,
  }));

  // Resolve a path to a Route object
  const resolve = (path: string): Route => {
    const result = matchRoute(path, compiled);
    return result
      ? { path, params: result.params }
      : { path, params: {} };
  };

  // Find the view for a path (or fallback)
  const findView = (path: string): (() => void) => {
    const result = matchRoute(path, compiled);
    return result ? result.view : config.fallback;
  };

  // Route store — single source of truth
  const routeStore: Store<Route> = store.new(resolve(getHashPath()));

  // Listen to hash changes (back/forward, manual edits)
  window.addEventListener("hashchange", () => {
    routeStore.set(resolve(getHashPath()));
  });

  // Programmatic navigation
  const navigate = (path: string): void => {
    window.location.hash = "#" + path;
  };

  // RouterView — subscribes to store, renders matched route
  const RouterView = view(({ use }) => {
    const route = use(routeStore);

    return {
      render() {
        findView(route.get().path)();
      },
    };
  });

  // Link — renders an <a> with click interception
  const Link = view<{ href: string; class?: string }>(({ props, slot }) => {
    const handleClick = (e: PointerEventData) => {
      e.preventDefault();
      navigate(props().href);
    };

    return {
      render() {
        const p = props();
        a(
          { href: "#" + p.href, class: p.class, onClick: handleClick },
          slot,
        );
      },
    };
  });

  return { routeStore, navigate, RouterView, Link };
}
