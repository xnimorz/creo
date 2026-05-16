import type { Key } from "@/functional/key";
import type { SlotContent, ViewBody, ViewFn } from "@/public/view";
import type { Maybe } from "@/functional/maybe";
import type { Wildcard } from "./wildcard";

// ---------------------------------------------------------------------------
// Bitwise flags
// ---------------------------------------------------------------------------

export type BitFlags = number;
export const F_PENDING = 1;
export const F_DIRTY = 1 << 1;
export const F_MOVED = 1 << 2;
export const F_PRIMITIVE = 1 << 3;
export const F_TEXT_CONTENT = 1 << 4;
export const F_DISPOSED = 1 << 5;

// ---------------------------------------------------------------------------
// ViewRecord — pure data, no methods
// ---------------------------------------------------------------------------

export type ViewRecord<
  Props = Wildcard,
  Api = Wildcard,
  RenderRef = Wildcard,
> = {
  viewFn: ViewFn<Props, Api>;
  userKey: Maybe<Key>;
  props: Props;
  slot: Maybe<SlotContent>;
  // Once ViewRecord moves from Pending to Real state,
  // it will cache the body of the view, so that ViewFn is called once per View Lifecycle
  body: Maybe<ViewBody<Props>>;
  // Provided by higher component slot — we calculate children and keep their refs here
  sc: Maybe<ViewRecord[]>;
  // Each renderer provides its own RenderRef type, associated with how the renderer works
  renderRef: Maybe<RenderRef>;

  flags: BitFlags;

  children: Maybe<ViewRecord[]>;

  /** Position in `parent.children`. Maintained by the reconciler so the
   * renderer can find the next-sibling insertion anchor without an O(n)
   * `indexOf` scan. -1 means "not yet placed by a reconcile pass". */
  pos: number;

  keyToView: Maybe<Map<Key, ViewRecord>>;
  unsubscribe: Maybe<(() => void)[]>;

  parent: Maybe<ViewRecord>;

  /** The primitive whose .children contains the live sc items after reconcile. */
  scHost: Maybe<ViewRecord>;

  /**
   * Last value the viewFn passed to `ctx.ref(...)`. Stored so the engine
   * can re-apply it when the consumer's `ref` prop changes between renders.
   */
  publicRef: Maybe<unknown>;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Structural change: viewFn, key, or count differs. Does NOT check props. */
export function hasScStructuralChange(
  prev: Maybe<ViewRecord[]>,
  next: Maybe<ViewRecord[]>,
): boolean {
  const prevLen = prev?.length ?? 0;
  const nextLen = next?.length ?? 0;
  if (prevLen === 0 && nextLen === 0) return false;
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    if (next[i]!.viewFn !== prev[i]!.viewFn) return true;
    if (next[i]!.userKey !== prev[i]!.userKey) return true;
  }
  return false;
}
