import type { Key } from "@/functional/key";
import * as P from "./primitives/primitives";
import { textViewFn, html } from "./primitives/primitives";
import { orchestrator } from "@/internal/orchestrator";
import type { SlotContent } from "./view";

/**
 * A JSX node is a lazy thunk. Calling it emits the corresponding view or
 * primitive into the currently-active render stream. Nothing happens until the
 * thunk is invoked; this lets JSX's inside-out evaluation order (children
 * first) still produce the outside-in emission order Creo's engine requires.
 */
export type JsxNode = () => void;

export type JsxChildren =
  | JsxNode
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<JsxChildren>;

export const Fragment = Symbol.for("creo.Fragment") as unknown as "fragment";

type CreoCallable = (props: Record<string, unknown> | void, slot?: SlotContent) => void;

// ---------------------------------------------------------------------------
// Tag registry — maps lowercase JSX tag strings to the primitive reference
// already exported from `primitives.ts`. Using the same reference is critical:
// the reconciler identifies primitive kinds by viewFn identity, so if `<div/>`
// resolved to a freshly-constructed `html("div")` it would not match a later
// imperative call to the exported `div` — reconciliation would dispose and
// remount instead of updating. Seed the registry from the existing exports.
// ---------------------------------------------------------------------------

// Exceptions: export name ≠ HTML tag.
const EXPORT_ALIASES: Record<string, string> = { varEl: "var" };
// Exports that aren't tag primitives (factory, text helper, etc.).
const NON_TAG_EXPORTS = new Set(["text", "textViewFn", "html"]);

const tagRegistry: Record<string, CreoCallable> = {};
for (const [name, value] of Object.entries(P)) {
  if (typeof value !== "function") continue;
  if (NON_TAG_EXPORTS.has(name)) continue;
  const tag = EXPORT_ALIASES[name] ?? name;
  tagRegistry[tag] = value as unknown as CreoCallable;
}

function resolveStringType(tag: string): CreoCallable {
  const known = tagRegistry[tag];
  if (known) return known;
  // Unknown tag (custom elements, SVG, etc.) — create a fresh primitive and
  // cache so repeated JSX uses share the same viewFn identity.
  const created = html(tag) as unknown as CreoCallable;
  tagRegistry[tag] = created;
  return created;
}


function emitChild(child: JsxChildren): void {
  if (child == null || typeof child === "boolean") return;
  if (typeof child === "string") {
    if (child.length === 0) return;
    orchestrator.currentEngine()!.view(textViewFn, child, null, null);
    return;
  }
  if (typeof child === "number") {
    orchestrator.currentEngine()!.view(textViewFn, String(child), null, null);
    return;
  }
  if (typeof child === "function") {
    (child as JsxNode)();
    return;
  }
  if (Array.isArray(child)) {
    for (const c of child) emitChild(c);
    return;
  }
}

function childrenToSlot(children: JsxChildren): SlotContent | undefined {
  if (children == null || children === false || children === true) return undefined;
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  return () => emitChild(children);
}

type JsxProps = { children?: JsxChildren } & Record<string, unknown>;

/**
 * Core JSX runtime factory. Called by the compiled JSX transform for every
 * element. Returns a lazy thunk — see {@link JsxNode}.
 *
 * `type` is either a Creo view/primitive (a `(props, slot?) => void` function),
 * the `Fragment` marker, or any other creo-callable. `key` is passed via the
 * third argument by the `react-jsx` transform; we merge it back into props.
 */
export function jsx(
  type: string | CreoCallable | typeof Fragment,
  props: JsxProps | null | undefined,
  key?: Key,
): JsxNode {
  return () => {
    const p = (props ?? {}) as JsxProps;
    const { children, ...rest } = p;
    const slot = childrenToSlot(children);

    if (type === Fragment) {
      if (slot) {
        if (typeof slot === "string") {
          orchestrator.currentEngine()!.view(textViewFn, slot, null, null);
        } else {
          slot();
        }
      }
      return;
    }

    const finalProps =
      key != null ? ({ ...rest, key } as Record<string, unknown>) : (rest as Record<string, unknown>);

    const fn = typeof type === "string" ? resolveStringType(type) : (type as CreoCallable);
    fn(finalProps, slot);
  };
}

/** Alias emitted by the `react-jsx` transform for static-children calls. */
export const jsxs = jsx;

/** Alias emitted by `react-jsxdev`. Extra diagnostic args are accepted and ignored. */
export function jsxDEV(
  type: string | CreoCallable | typeof Fragment,
  props: JsxProps | null | undefined,
  key?: Key,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): JsxNode {
  return jsx(type, props, key);
}

// The JSX namespace itself is declared in `../jsx-runtime.ts` /
// `../jsx-dev-runtime.ts` so the `react-jsx` transform can locate it via
// `jsxImportSource: "creo"`.
