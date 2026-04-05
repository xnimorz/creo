import type { Key } from "@/functional/key";
import type { Slot, ViewBody, ViewFn } from "@/public/view";
import type { Maybe } from "@/functional/maybe";
import type { Wildcard } from "./wildcard";

// ---------------------------------------------------------------------------
// Bitwise flags
// ---------------------------------------------------------------------------

export type BitFlags = number;
export const F_PENDING = 1;
export const F_DIRTY = 1 << 1;
export const F_MOVED = 1 << 2;
export const F_QUICK_RERENDER = 1 << 3;
export const F_PRIMITIVE = 1 << 4;
export const F_TEXT_CONTENT = 1 << 5;

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
  slot: Maybe<Slot>;
  // Once ViewRecord moves from Pending to Real state,
  // it will cache the body of the view, so that ViewFn is called once per View Lifecycle
  body: Maybe<ViewBody<Props, Api>>;
  // Provided by higher component slot — we calculate children and keep their refs here
  sc: Maybe<ViewRecord[]>;
  // Each renderer provides its own RenderRef type, associated with how the renderer works
  renderRef: Maybe<RenderRef>;

  flags: BitFlags;

  children: Maybe<ViewRecord[]>;

  keyToView: Maybe<Map<Key, ViewRecord>>;
  unsubscribe: Maybe<(() => void)[]>;

  parent: Maybe<ViewRecord>;
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function hasNewSlotChildren(
  prev: Maybe<ViewRecord[]>,
  next: Maybe<ViewRecord[]>,
): boolean {
  const prevLen = prev?.length ?? 0;
  const nextLen = next?.length ?? 0;
  if (prevLen === 0 && nextLen === 0) return false;
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    const n = next[i]!;
    const p = prev[i]!;
    if (n.viewFn !== p.viewFn) return true;
    if (n.userKey !== p.userKey) return true;
    if (n.props !== p.props) return true;
    // TODO we need optimise this — essentially parent is responsible for children to be there,
    // but children themselves are responsible for their params
  }
  return false;
}
