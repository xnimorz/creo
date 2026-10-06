import type { IRender } from "@/render/render_interface";
import {
  type ViewRecord,
  hasScStructuralChange,
  F_DIRTY,
  F_MOVED,
  F_PRIMITIVE,
  F_PENDING,
  F_DISPOSED,
} from "./internal_view";
import type { Wildcard } from "./wildcard";
import { type Maybe } from "@/functional/maybe";
import type { Key } from "@/functional/key";
import type { Ref, SlotContent, ViewFn } from "@/public/view";
import { applyRef } from "@/public/view";
import { textViewFn } from "@/public/primitives/primitives";
import { $primitive } from "@/public/primitive";
import { State, type Reactive } from "@/public/state";
import { Store, isStore } from "@/public/store";
import { shallowEqual } from "@/functional/shallow_equal";
import { lis } from "@/functional/lis";
import { orchestrator } from "./orchestrator";

export type Scheduler = (callback: () => void) => void;

function getConsumerRef(view: ViewRecord): Maybe<Ref<unknown>> {
  if (view.flags & F_PRIMITIVE) return undefined;
  return view.props?.ref;
}

export class Engine {
  #dirtyQueue = new Set<ViewRecord>();
  #collector: Maybe<ViewRecord[]>;
  #collectFor: Maybe<ViewRecord>;

  #scheduler: Scheduler;
  #renderScheduled = false;
  #rendering = false;

  // Reused to reduce GC
  #idxScratch: number[] = [];

  // New children [from, to) from the last reconcile(); caller mounts them
  #runFrom = 0;
  #runTo = 0;

  constructor(
    public renderer: IRender<Wildcard>,
    scheduler?: Scheduler,
  ) {
    this.#scheduler = scheduler ?? ((cb) => queueMicrotask(cb));
    renderer.engine = this;
  }

  // -- Record initialization --------------------------------------------------
  newView<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    viewFn: ViewFn<Props, Api>,
    parent: Maybe<ViewRecord>,
    props: Props,
    slot: Maybe<SlotContent>,
    userKey: Maybe<Key>,
  ): ViewRecord {
    const res: ViewRecord = {
      viewFn,
      userKey,
      props,
      slot,
      body: null,
      sc: null,
      renderRef: null,

      flags: F_PENDING | (viewFn[$primitive] != null ? F_PRIMITIVE : 0),

      children: null,

      keyToView: null,
      unsubscribe: null,
      parent,
      scHost: null,
      pos: -1,
      publicRef: null,
    };
    if (slot) {
      if (typeof slot === "string") {
        // Inline text record: no closure, no collector trip
        res.sc = [
          this.newView(
            textViewFn as ViewFn<Wildcard, Wildcard>,
            res,
            slot,
            null,
            null,
          ),
        ];
      } else {
        res.sc = this.#collect(slot, [], res);
      }
    }
    return res;
  }

  view<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    viewFn: ViewFn<Props, Api>,
    props: Props,
    slot: Maybe<SlotContent>,
    userKey: Maybe<Key>,
  ): ViewRecord<Props, Api, RenderRef> {
    const view = this.newView(viewFn, this.#collectFor, props, slot, userKey);
    this.#collector?.push(view);
    return view;
  }

  views(views: Maybe<ViewRecord[]>): void {
    if (views) this.#collector?.push(...views);
  }

  initViewBody(view: ViewRecord): void {
    if (!(view.flags & F_PENDING)) return;

    view.flags &= ~F_PENDING;

    if (view.flags & F_PRIMITIVE) {
      const engine = this;
      view.body = {
        render() {
          engine.views(view.sc);
        },
      };
      return;
    }
    view.body = view.viewFn({
      props: () => view.props,
      use: <T>(storeOrState: T | Store<T>): Reactive<T> => {
        if (!isStore(storeOrState)) {
          return new State(storeOrState, () => this.markDirty(view));
        }
        const s = storeOrState;
        const unsub = s.subscribe(() => this.markDirty(view));
        if (!view.unsubscribe) view.unsubscribe = [];
        view.unsubscribe.push(unsub);
        return s;
      },
      slot: () => {
        if (!view.sc) return;
        view.scHost = this.#collectFor ?? view;
        for (const child of view.sc) {
          child.parent = this.#collectFor ?? view;
          this.#collector?.push(child);
        }
      },
      // Callable later (onMount, async) to swap the exposed value
      ref: (value: unknown) => {
        view.publicRef = value;
        applyRef(getConsumerRef(view), value);
      },
    });
  }

  createRoot(children: () => void, props: Wildcard): ViewRecord {
    orchestrator.setCurrentEngine(this);
    const view = this.newView(
      ({ slot }) => ({
        render() {
          slot();
        },
      }),
      null,
      props,
      children,
      null,
    );
    this.markDirty(view);
    return view;
  }

  // -- Dirty tracking ---------------------------------------------------------

  markDirty<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    view: ViewRecord<Props, Api, RenderRef>,
  ): void {
    if (view.flags & F_DISPOSED) return;
    if (view.flags & F_DIRTY) {
      return;
    }
    view.flags |= F_DIRTY;
    this.#dirtyQueue.add(view);
    this.schedule();
  }

  markMoved<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    view: ViewRecord<Props, Api, RenderRef>,
  ): void {
    if (view.flags & F_DISPOSED) return;
    if (view.flags & F_MOVED) {
      return;
    }
    view.flags |= F_MOVED;
    this.#dirtyQueue.add(view);
    this.schedule();
  }

  schedule(): void {
    if (this.#renderScheduled) return;
    this.#renderScheduled = true;
    this.#scheduler(() => {
      this.#renderScheduled = false;
      this.render();
    });
  }

  // -- Collector --------------------------------------------------------------

  #collect(
    render: () => void,
    collector: ViewRecord[],
    parent: ViewRecord,
  ): ViewRecord[] {
    const before = this.#collector;
    const beforeParent = this.#collectFor;
    this.#collector = collector;
    this.#collectFor = parent;
    render();
    this.#collector = before;
    this.#collectFor = beforeParent;
    return collector;
  }

  // -- Props update -----------------------------------------------------------

  nextProps<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    view: ViewRecord<Props, Api, RenderRef>,
    nextProps: Props,
    nextSlot: Maybe<SlotContent>,
    preCollectedSc?: Maybe<ViewRecord[]>,
  ): void {
    // Consumer swapped `ref`: detach old, seed new. Must run before view.props is overwritten.
    const prevRef = getConsumerRef(view);
    const nextRef = (nextProps as { ref?: Ref<unknown> } | null | undefined)
      ?.ref;
    if (prevRef !== nextRef) {
      if (prevRef) applyRef(prevRef, null);
      if (nextRef && view.publicRef != null) applyRef(nextRef, view.publicRef);
    }

    const prevSc = view.sc;
    view.slot = nextSlot;
    if (preCollectedSc) {
      // sc items were parented to the pending view
      for (const child of preCollectedSc) child.parent = view;
      view.sc = preCollectedSc;
    } else if (nextSlot) {
      if (typeof nextSlot === "string") {
        view.sc = [
          this.newView(
            textViewFn as ViewFn<Wildcard, Wildcard>,
            view,
            nextSlot,
            null,
            null,
          ),
        ];
      } else {
        view.sc = this.#collect(nextSlot, [], view);
      }
    } else {
      view.sc = null;
    }

    const structChanged = hasScStructuralChange(prevSc, view.sc);
    const shouldUpdate = view.body?.shouldUpdate
      ? view.body.shouldUpdate(nextProps)
      : !shallowEqual(view.props, nextProps) ||
        // Live DOM may have drifted from props (user typed into <input value>)
        ((view.flags & F_PRIMITIVE) !== 0 &&
          this.renderer.shouldReassert?.(view, nextProps) === true);

    if (shouldUpdate || structChanged) {
      view.props = nextProps;
      this.markDirty(view);
    } else if (view.sc && view.scHost?.children) {
      // Stable structure: push sc prop changes straight to live children
      this.#propagateScProps(view);
    } else if (view.sc && prevSc) {
      // No scHost (primitive)
      for (let i = 0; i < view.sc.length; i++) {
        if (view.sc[i]!.props !== prevSc[i]!.props) {
          this.markDirty(view);
          break;
        }
      }
    }
  }

  #propagateScProps(owner: ViewRecord): void {
    const host = owner.scHost;
    const sc = owner.sc;
    if (!host?.children || !sc) return;

    if (host.keyToView) {
      for (const item of sc) {
        if (item.userKey != null) {
          const live = host.keyToView.get(item.userKey);
          if (live && live.viewFn === item.viewFn) {
            this.nextProps(live, item.props, item.slot);
          }
        }
      }
    } else {
      const len = Math.min(sc.length, host.children.length);
      for (let i = 0; i < len; i++) {
        const live = host.children[i]!;
        if (live.viewFn === sc[i]!.viewFn) {
          this.nextProps(live, sc[i]!.props, sc[i]!.slot);
        }
      }
    }
  }

  // -- Reconciliation ---------------------------------------------------------

  reconcile(view: ViewRecord): void {
    this.#runFrom = this.#runTo = 0;
    let pendingChildren: Maybe<ViewRecord[]> = null;
    if (view.body?.render) {
      pendingChildren = this.#collect(view.body.render, [], view);
    }

    if (pendingChildren == null || pendingChildren.length === 0) {
      if (view.children) for (const child of view.children) this.dispose(child);
      return;
    }

    if (view.children == null) {
      view.children = pendingChildren;
      for (let i = 0; i < pendingChildren.length; i++) {
        const child = pendingChildren[i]!;
        child.pos = i;
        this.#registerKey(view, child);
      }
      this.#runTo = pendingChildren.length;
      return;
    }
    let hasKeys = false;
    for (let k = 0; k < pendingChildren.length; k++) {
      if (pendingChildren[k]!.userKey != null) {
        hasKeys = true;
        break;
      }
    }
    if (hasKeys) {
      this.#reconcileKeyed(view, view.children, pendingChildren);
    } else {
      this.#reconcileNonKeyed(view, view.children, pendingChildren);
    }
  }

  // -- Non-keyed reconciliation ------------------------------------------------

  #reconcileNonKeyed(
    view: ViewRecord,
    oldChildren: ViewRecord[],
    pending: ViewRecord[],
  ): void {
    const oldLen = oldChildren.length;
    const newLen = pending.length;
    const minLen = Math.min(oldLen, newLen);

    for (let i = 0; i < minLen; i++) {
      const old = oldChildren[i]!;
      const pend = pending[i]!;
      this.#patchOrReplace(view, oldChildren, i, old, pend);
      oldChildren[i]!.pos = i;
    }

    for (let i = oldLen; i < newLen; i++) {
      oldChildren[i] = pending[i]!;
      pending[i]!.pos = i;
    }
    if (newLen > oldLen) {
      this.#runFrom = oldLen;
      this.#runTo = newLen;
    }

    for (let i = newLen; i < oldLen; i++) {
      this.dispose(oldChildren[i]!);
    }
    oldChildren.length = newLen;
  }

  // -- Keyed reconciliation

  #reconcileKeyed(
    view: ViewRecord,
    oldChildren: ViewRecord[],
    pending: ViewRecord[],
  ): void {
    let i = 0;
    let oldEnd = oldChildren.length - 1;
    let newEnd = pending.length - 1;

    // Phase 1: head sync
    while (i <= oldEnd && i <= newEnd) {
      const oldView = oldChildren[i]!;
      const pendView = pending[i]!;
      if (oldView.userKey !== pendView.userKey) break;
      this.#patchOrReplace(view, oldChildren, i, oldView, pendView);
      i++;
    }

    // Phase 2: tail sync
    while (oldEnd >= i && newEnd >= i) {
      const oldView = oldChildren[oldEnd]!;
      const pendView = pending[newEnd]!;
      if (oldView.userKey !== pendView.userKey) break;
      this.#patchOrReplace(view, oldChildren, oldEnd, oldView, pendView);
      oldEnd--;
      newEnd--;
    }

    // Phase 3: pure insertion / removal
    if (i > oldEnd) {
      for (let j = i; j <= newEnd; j++) {
        this.#registerKey(view, pending[j]!);
      }
      this.#runFrom = i;
      this.#runTo = newEnd + 1;
      // head + insertions + tail, pre-sized
      const tailStart = oldEnd + 1;
      const tailLen = oldChildren.length - tailStart;
      const insertCount = newEnd - i + 1;
      const out = new Array<ViewRecord>(i + insertCount + tailLen);
      for (let j = 0; j < i; j++) {
        const c = oldChildren[j]!;
        c.pos = j;
        out[j] = c;
      }
      for (let j = 0; j < insertCount; j++) {
        const c = pending[i + j]!;
        c.pos = i + j;
        out[i + j] = c;
      }
      for (let j = 0; j < tailLen; j++) {
        const c = oldChildren[tailStart + j]!;
        c.pos = i + insertCount + j;
        out[i + insertCount + j] = c;
      }
      view.children = out;
      return;
    }

    if (i > newEnd) {
      for (let j = i; j <= oldEnd; j++) {
        this.dispose(oldChildren[j]!);
      }
      // head + tail, pre-sized
      const tailStart = oldEnd + 1;
      const tailLen = oldChildren.length - tailStart;
      const out = new Array<ViewRecord>(i + tailLen);
      for (let j = 0; j < i; j++) {
        const c = oldChildren[j]!;
        c.pos = j;
        out[j] = c;
      }
      for (let j = 0; j < tailLen; j++) {
        const c = oldChildren[tailStart + j]!;
        c.pos = i + j;
        out[i + j] = c;
      }
      view.children = out;
      return;
    }

    // Phase 4: middle diff
    const newKeyToIndex = new Map<Key, number>();
    for (let j = i; j <= newEnd; j++) {
      const key = pending[j]!.userKey;
      if (key != null) newKeyToIndex.set(key, j);
    }

    const middleLen = newEnd - i + 1;
    // newIdxToOldIdx[j] = old index of pending[i+j], or -1 if new
    const newIdxToOldIdx = this.#idxScratch;
    newIdxToOldIdx.length = middleLen;
    for (let k = 0; k < middleLen; k++) newIdxToOldIdx[k] = -1;

    // Match and dispose in one pass — no `matched` Set needed
    for (let j = i; j <= oldEnd; j++) {
      const oldView = oldChildren[j]!;
      const key = oldView.userKey;
      const newIdx = key != null ? newKeyToIndex.get(key) : undefined;
      if (newIdx !== undefined) {
        newIdxToOldIdx[newIdx - i] = j;
      } else {
        this.dispose(oldView);
      }
    }

    // LIS members stay in place
    const stable = lis(newIdxToOldIdx);

    // head + middle + tail, pre-sized
    const tailStart = oldEnd + 1;
    const tailLen = oldChildren.length - tailStart;
    const out = new Array<ViewRecord>(i + middleLen + tailLen);
    for (let j = 0; j < i; j++) {
      const c = oldChildren[j]!;
      c.pos = j;
      out[j] = c;
    }
    for (let j = middleLen - 1; j >= 0; j--) {
      const newIdx = i + j;
      const pendView = pending[newIdx]!;

      if (newIdxToOldIdx[j] === -1) {
        this.initViewBody(pendView);
        this.markDirty(pendView);
        this.#registerKey(view, pendView);
        pendView.pos = i + j;
        out[i + j] = pendView;
      } else {
        const oldView = oldChildren[newIdxToOldIdx[j]!]!;
        this.#patchOrReplace(
          view,
          oldChildren,
          newIdxToOldIdx[j]!,
          oldView,
          pendView,
        );
        if (!stable.has(j)) {
          this.markMoved(oldView);
        }
        // May be pendView if #patchOrReplace replaced it
        const placed = oldChildren[newIdxToOldIdx[j]!]!;
        placed.pos = i + j;
        out[i + j] = placed;
      }
    }
    for (let j = 0; j < tailLen; j++) {
      const c = oldChildren[tailStart + j]!;
      c.pos = i + middleLen + j;
      out[i + middleLen + j] = c;
    }
    view.children = out;
  }

  #patchOrReplace(
    parent: ViewRecord,
    oldChildren: ViewRecord[],
    idx: number,
    oldView: ViewRecord,
    pendView: ViewRecord,
  ): void {
    if (oldView.viewFn === pendView.viewFn) {
      this.nextProps(oldView, pendView.props, pendView.slot, pendView.sc);
    } else {
      this.dispose(oldView);
      oldChildren[idx] = pendView;
      this.initViewBody(pendView);
      this.markDirty(pendView);
      this.#registerKey(parent, pendView);
    }
  }

  // -- Disposal ---------------------------------------------------------------

  dispose(view: ViewRecord): void {
    // Iterative (deep trees can't overflow); disposed back-to-front so children go first
    const nodes: ViewRecord[] = [view];
    const virtuals: boolean[] = [false];
    for (let read = 0; read < nodes.length; read++) {
      const node = nodes[read]!;
      const virtual = virtuals[read]!;
      if (node.children) {
        // Virtual: an ancestor primitive's DOM removal already takes this node
        const childVirtual =
          virtual ||
          ((node.flags & F_PRIMITIVE) !== 0 && node.renderRef != null);
        for (const child of node.children) {
          nodes.push(child);
          virtuals.push(childVirtual);
        }
      }
    }
    for (let k = nodes.length - 1; k >= 0; k--) {
      this.#disposeNode(nodes[k]!, virtuals[k]!);
    }
  }

  #disposeNode(view: ViewRecord, virtual: boolean): void {
    view.body?.dispose?.();
    applyRef(getConsumerRef(view), null);
    if (view.unsubscribe) for (const unsub of view.unsubscribe) unsub();
    if (view.userKey != null) view.parent?.keyToView?.delete(view.userKey);
    if (virtual) {
      view.renderRef = undefined;
    } else {
      this.renderer.unmount(view);
    }
    this.#dirtyQueue.delete(view);
    view.flags |= F_DISPOSED;
    view.flags &= ~(F_DIRTY | F_MOVED);
  }

  #registerKey(parent: ViewRecord, child: ViewRecord): void {
    if (child.userKey == null) return;
    if (!parent.keyToView) parent.keyToView = new Map();
    parent.keyToView.set(child.userKey, child);
  }

  // -- Mounting ---------------------------------------------------------------

  /** Depth-first: create pre-order, attach post-order. */
  #mountTree(view: ViewRecord, cbs: (() => void)[]): void {
    // Makes state.set() inside the viewFn a no-op
    view.flags |= F_DIRTY;
    this.initViewBody(view);
    this.reconcile(view);
    this.renderer.render(view);
    // Clear before descending so descendants can re-queue this view
    view.flags &= ~(F_DIRTY | F_MOVED);
    if (view.body?.onMount) {
      const b = view.body;
      cbs.push(() => b.onMount!());
    }
    const children = view.children;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        this.#mountTree(children[i]!, cbs);
      }
    }
    this.renderer.attach?.(view);
  }

  /** New siblings share one anchor, computed for the first. */
  #mountRun(
    parent: ViewRecord,
    from: number,
    to: number,
    cbs: (() => void)[],
  ): void {
    const children = parent.children!;
    let anchor: unknown = undefined;
    for (let i = from; i < to; i++) {
      const child = children[i]!;
      anchor = this.renderer.beginMount?.(child, anchor);
      this.#mountTree(child, cbs);
      this.renderer.endMount?.(child);
    }
  }

  // -- Render loop ------------------------------------------------------------

  render(): void {
    if (this.#rendering) return;

    orchestrator.setCurrentEngine(this);
    this.#rendering = true;

    try {
      const cbs: (() => void)[] = [];
      for (const view of this.#dirtyQueue) {
        // Delete first so a re-mark in this pass re-adds past the iterator
        this.#dirtyQueue.delete(view);
        if (view.flags & F_DISPOSED) continue;

        if (!view.renderRef) {
          this.renderer.beginMount?.(view);
          this.#mountTree(view, cbs);
          this.renderer.endMount?.(view);
          continue;
        }

        view.body?.onUpdateBefore?.();

        if (view.flags & F_DIRTY) {
          this.reconcile(view);
          const runFrom = this.#runFrom;
          const runTo = this.#runTo;
          this.renderer.render(view);
          view.flags &= ~F_DIRTY;
          view.flags &= ~F_MOVED;

          if (view.body?.onUpdateAfter) {
            const b = view.body;
            cbs.push(() => b.onUpdateAfter!());
          }
          if (runTo > runFrom) this.#mountRun(view, runFrom, runTo, cbs);
        } else {
          this.renderer.render(view);
          view.flags &= ~F_MOVED;
        }
      }

      orchestrator.setCurrentEngine(null);
      this.#rendering = false;
      for (const cb of cbs) cb();
    } catch (e) {
      orchestrator.setCurrentEngine(null);
      this.#rendering = false;
      throw e;
    }
  }
}
