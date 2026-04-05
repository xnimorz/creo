import type { IRender } from "@/render/render_interface";
import {
  type ViewRecord,
  hasNewSlotChildren,
  F_DIRTY,
  F_MOVED,
  F_PRIMITIVE,
  F_PENDING,
} from "./internal_view";
import type { Wildcard } from "./wildcard";
import { isNone, type Maybe } from "@/functional/maybe";
import type { Key } from "@/functional/key";
import type { Slot, ViewFn } from "@/public/view";
import { $primitive } from "@/public/primitive";
import { State, type Reactive } from "@/public/state";
import { Store, isStore } from "@/public/store";
import { shallowEqual } from "@/functional/shallow_equal";
import { lis } from "@/functional/lis";
import { orchestrator } from "./orchestrator";

export type Scheduler = (callback: () => void) => void;

export class Engine {
  #dirtyQueue = new Set<ViewRecord>();

  // Collector struct-of-arrays buffer (shared, reused)
  // #pvViewFns: ViewFn<any, any>[] = [];
  // #pvProps: any[] = [];
  // #pvSlots: ((() => void) | null)[] = [];
  // #pvKeys: (Key | null)[] = [];
  // #pvLen = 0;
  // #collectStack: number[] = [];
  #collector: Maybe<ViewRecord[]>;
  #collectFor: Maybe<ViewRecord>;

  #scheduler: Scheduler;
  #renderScheduled = false;
  #rendering = false;
  #inlineDepth = 0;

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
    slot: Maybe<Slot>,
    userKey: Maybe<Key>,
  ): ViewRecord {
    const res: ViewRecord = {
      viewFn,
      userKey,
      props,
      slot,
      // View was not rendered yet, so there is no body
      body: null,
      // slot was not called _yet_, so there is no slot children
      sc: null,
      // there is no renderer _yet_
      renderRef: null,

      flags: F_PENDING | (viewFn[$primitive] != null ? F_PRIMITIVE : 0),

      children: null,

      keyToView: null,
      unsubscribe: null,
      parent,

      /** Per-instance render cache. Indexed by slot. */
      // renderCache: Maybe<unknown[]>;
    };
    if (slot) {
      res.sc = this.#collect(slot, [], res);
    }
    return res;
  }

  // called when view renders view
  // Saved potential pending view to collector for further reconsilication
  view<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
    viewFn: ViewFn<Props, Api>,
    props: Props,
    slot: Maybe<Slot>,
    userKey: Maybe<Key>,
  ): ViewRecord<Props, Api, RenderRef> {
    const view = this.newView(viewFn, this.#collectFor, props, slot, userKey);
    this.#collector?.push(view);
    return view;
  }

  views(views: Maybe<ViewRecord[]>): void {
    if (views) this.#collector?.push(...views);
  }

  // ViewRecord already exist, but we still need to initialise the whole record
  initViewBody(view: ViewRecord): void {
    // Only for non initialised views:
    if (!(view.flags & F_PENDING)) return;

    view.flags &= ~F_PENDING;

    // If view is primitive
    if (view.flags & F_PRIMITIVE) {
      const engine = this;
      view.body = {
        render() {
          engine.views(view.sc);
        },
      };
      return;
    }
    // View is composite
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
        for (const child of view.sc) {
          child.parent = this.#collectFor ?? view;
          this.#collector?.push(child);
        }
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
    if (view.flags & F_MOVED) {
      return;
    }
    view.flags |= F_MOVED;
    this.#dirtyQueue.add(view);
    this.schedule();
  }

  // #removeDirty<Props = Wildcard, Api = Wildcard, RenderRef = Wildcard>(
  //   view: ViewRecord<Props, Api, RenderRef>,
  // ): void {
  // view.flags &= ~F_DIRTY;
  // view.flags &= ~F_MOVED;
  //   this.#dirtyQueue.delete(view);
  // }

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
    nextSlot: Maybe<Slot>,
  ): void {
    const prevSc = view.sc;
    view.slot = nextSlot;
    view.sc = nextSlot ? this.#collect(nextSlot, [], view) : null;
    const scChanged = hasNewSlotChildren(prevSc, view.sc);
    const shouldUpdate = view.body?.shouldUpdate
      ? view.body.shouldUpdate(nextProps)
      : !shallowEqual(view.props, nextProps);
    if (shouldUpdate || scChanged) {
      view.props = nextProps;
      this.markDirty(view);
    }
  }

  // -- Reconciliation ---------------------------------------------------------

  reconcile(view: ViewRecord): void {
    let pendingChildren: Maybe<ViewRecord[]> = null;
    if (view.body?.render) {
      pendingChildren = this.#collect(view.body.render, [], view);
    }

    if (pendingChildren == null || pendingChildren.length === 0) {
      // No children case
      if (view.children) for (const child of view.children) this.dispose(child);
      return;
    }

    // We do not have any previous children. In this case, we just insert new items and that's it
    if (view.children == null) {
      view.children = pendingChildren;
      for (const child of pendingChildren) {
        this.initViewBody(child);
        this.markDirty(child);
        if (child.userKey != null) {
          if (!view.keyToView) view.keyToView = new Map();
          view.keyToView.set(child.userKey, child);
        }
      }
      return;
    }
    // Now, we have both view.children & pendingChildren
    // Check if any child is keyed — if so, use keyed algorithm
    const hasKeys = pendingChildren.some((c) => c.userKey != null);
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

    // Patch overlapping range by position
    for (let i = 0; i < minLen; i++) {
      const old = oldChildren[i]!;
      const pend = pending[i]!;
      this.#patchOrReplace(view, oldChildren, i, old, pend);
    }

    // Mount new children
    for (let i = oldLen; i < newLen; i++) {
      oldChildren[i] = pending[i]!;
      this.initViewBody(pending[i]!);
      this.markDirty(pending[i]!);
    }

    // Dispose removed children
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

    // Phase 1: Head sync — match from start
    while (i <= oldEnd && i <= newEnd) {
      const oldView = oldChildren[i]!;
      const pendView = pending[i]!;
      if (oldView.userKey !== pendView.userKey) break;
      this.#patchOrReplace(view, oldChildren, i, oldView, pendView);
      i++;
    }

    // Phase 2: Tail sync — match from end
    while (oldEnd >= i && newEnd >= i) {
      const oldView = oldChildren[oldEnd]!;
      const pendView = pending[newEnd]!;
      if (oldView.userKey !== pendView.userKey) break;
      this.#patchOrReplace(view, oldChildren, oldEnd, oldView, pendView);
      oldEnd--;
      newEnd--;
    }

    // Phase 3: Simple cases
    if (i > oldEnd) {
      // All remaining pending are insertions
      for (let j = i; j <= newEnd; j++) {
        this.initViewBody(pending[j]!);
        this.markDirty(pending[j]!);
        if (pending[j]!.userKey != null) {
          if (!view.keyToView) view.keyToView = new Map();
          view.keyToView.set(pending[j]!.userKey!, pending[j]!);
        }
      }
      // Rebuild children array
      view.children = [
        ...oldChildren.slice(0, i),
        ...pending.slice(i, newEnd + 1),
        ...oldChildren.slice(i, oldEnd + 1), // tail-synced portion is already patched
      ];
      return;
    }

    if (i > newEnd) {
      // All remaining old are removals
      for (let j = i; j <= oldEnd; j++) {
        this.dispose(oldChildren[j]!);
      }
      // Rebuild children array: head + tail
      view.children = [
        ...oldChildren.slice(0, i),
        ...oldChildren.slice(oldEnd + 1),
      ];
      return;
    }

    // Phase 4: Middle diff
    // Build map: pending key → index in pending
    const newKeyToIndex = new Map<Key, number>();
    for (let j = i; j <= newEnd; j++) {
      const key = pending[j]!.userKey;
      if (key != null) newKeyToIndex.set(key, j);
    }

    const middleLen = newEnd - i + 1;
    // newIdxToOldIdx[j] = old index of the view now at pending[i+j], or -1 if new
    const newIdxToOldIdx = new Array<number>(middleLen).fill(-1);
    // Track which old children were matched
    const matched = new Set<number>();

    for (let j = i; j <= oldEnd; j++) {
      const oldView = oldChildren[j]!;
      const key = oldView.userKey;
      if (key != null && newKeyToIndex.has(key)) {
        const newIdx = newKeyToIndex.get(key)!;
        newIdxToOldIdx[newIdx - i] = j;
        matched.add(j);
      }
    }

    // Dispose unmatched old children
    for (let j = i; j <= oldEnd; j++) {
      if (!matched.has(j)) {
        this.dispose(oldChildren[j]!);
      }
    }

    // Compute LIS on the old indices — these views stay in place
    const stable = lis(newIdxToOldIdx);

    // Build new children array for the middle portion
    const newChildren: ViewRecord[] = new Array(middleLen);
    for (let j = middleLen - 1; j >= 0; j--) {
      const newIdx = i + j;
      const pendView = pending[newIdx]!;

      if (newIdxToOldIdx[j] === -1) {
        // New child — init and mount
        this.initViewBody(pendView);
        this.markDirty(pendView);
        if (pendView.userKey != null) {
          if (!view.keyToView) view.keyToView = new Map();
          view.keyToView.set(pendView.userKey, pendView);
        }
        newChildren[j] = pendView;
      } else {
        // Matched child — reuse the old view
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
        newChildren[j] = oldView;
      }
    }

    // Rebuild view.children: head + middle + tail
    const head = oldChildren.slice(0, i);
    const tail = oldChildren.slice(oldEnd + 1);
    view.children = [...head, ...newChildren, ...tail];
  }

  /** Patch an existing view with pending props, or replace if viewFn changed. */
  #patchOrReplace(
    parent: ViewRecord,
    oldChildren: ViewRecord[],
    idx: number,
    oldView: ViewRecord,
    pendView: ViewRecord,
  ): void {
    if (oldView.viewFn === pendView.viewFn) {
      this.nextProps(oldView, pendView.props, pendView.slot);
    } else {
      this.dispose(oldView);
      oldChildren[idx] = pendView;
      this.initViewBody(pendView);
      this.markDirty(pendView);
      if (pendView.userKey != null) {
        if (!parent.keyToView) parent.keyToView = new Map();
        parent.keyToView.set(pendView.userKey, pendView);
      }
    }
  }

  // -- Disposal ---------------------------------------------------------------

  dispose(view: ViewRecord): void {
    // If this is a primitive with a DOM element, removing it from DOM
    // automatically removes all descendant DOM nodes. Only do virtual
    // cleanup (unsubscribe, key removal, dirty queue) for children.
    const isPrimitiveWithDom = view.flags & F_PRIMITIVE && view.renderRef;

    if (view.children) {
      for (const child of view.children) {
        if (isPrimitiveWithDom) {
          this.#disposeVirtual(child);
        } else {
          this.dispose(child);
        }
      }
    }
    if (view.unsubscribe) for (const unsub of view.unsubscribe) unsub();
    if (view.userKey != null) view.parent?.keyToView?.delete(view.userKey);
    this.renderer.unmount(view);
    this.#dirtyQueue.delete(view);
  }

  /** Dispose without DOM removal — parent primitive handles DOM cleanup. */
  #disposeVirtual(view: ViewRecord): void {
    if (view.children) {
      for (const child of view.children) this.#disposeVirtual(child);
    }
    if (view.unsubscribe) for (const unsub of view.unsubscribe) unsub();
    if (view.userKey != null) view.parent?.keyToView?.delete(view.userKey);
    view.renderRef = undefined;
    this.#dirtyQueue.delete(view);
  }

  // -- Render loop ------------------------------------------------------------

  render(): void {
    // Already rendering. Exit.
    if (this.#rendering) return;

    // Orchestrator should know which engine is currently active.
    // Inside single task only one engine can be active
    orchestrator.setCurrentEngine(this);
    this.#rendering = true;

    try {
      const cbs: (() => void)[] = [];
      for (const view of this.#dirtyQueue) {
        this.initViewBody(view);
        const isNew = !view.renderRef;
        if (!isNew) view.body?.onUpdateBefore?.();

        if (view.flags & F_DIRTY) {
          // Full re-render
          this.reconcile(view);
          this.renderer.render(view);
          view.flags &= ~F_DIRTY;
          view.flags &= ~F_MOVED;

          if (isNew && view.body?.onMount) {
            const b = view.body;
            cbs.push(() => b.onMount!());
          } else if (!isNew && view.body?.onUpdateAfter) {
            const b = view.body;
            cbs.push(() => b.onUpdateAfter!());
          }
        } else {
          // Move only
          this.renderer.render(view);
          view.flags &= ~F_MOVED;
        }
      }

      this.#dirtyQueue.clear();
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
