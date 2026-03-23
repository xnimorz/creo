import type { Key } from "@/functional/key";
import type { ViewBody, ViewFn } from "@/public/view";
import type { Wildcard } from "./wildcard";
import type { Engine } from "./engine";
import { createStateFactory, type StateFactory } from "@/public/state";
import { Store } from "@/public/store";
import { $primitive } from "@/public/primitive";
import { IndexedList } from "@/structures/indexed_list";
import type { INode } from "@/structures/list";
import { just, type Maybe } from "@/functional/maybe";
import { shallowEqual } from "@/functional/shallow_equal";

export type PendingView = {
  viewFn: ViewFn<Wildcard, Wildcard>;
  props: Wildcard;
  slot: Wildcard;
  userKey: Maybe<Key>;
};

// Shared no-op instances for primitives
const noopState: StateFactory = () => {
  throw new Error("Primitives cannot use state()");
};
const noopFlush = () => {};
const noopStore = {} as Store;
const noopBody: ViewBody<Wildcard, Wildcard> = { render() {} };

// Shared empty instances for views that never have children
const EMPTY_VDOM = new IndexedList<View>();
const EMPTY_KEY_MAP: Map<Key, View> = new Map();

export class View implements Disposable {
  virtualDom: IndexedList<View> = EMPTY_VDOM;
  keyToView: Map<Key, View> = EMPTY_KEY_MAP;
  viewBody: ViewBody<Wildcard, Wildcard>;
  api: Wildcard;

  /** Renderer-specific data (DOM node, comment pair, JSON node, etc.) */
  renderRef: unknown;

  /** Node reference in parent's virtualDom linked list. O(1) getNextSibling. */
  _vdomNode: Maybe<INode<View>>;

  /** Mutable context passed to viewFn — updated on nextProps so closures see current values. */
  public ctx!: {
    props: Wildcard;
    state: StateFactory;
    store: Store;
    slot: Wildcard;
  };
  private stateFlush: () => void;
  private _disposed = false;

  /** True if this view wraps a primitive (no state/store needed). */
  readonly isPrimitive: boolean;

  /** Double-buffer: previous virtualDom reused as next render's target. */
  private _prevDom: Maybe<IndexedList<View>>;

  get props(): Wildcard {
    return this.ctx.props;
  }

  set props(v: Wildcard) {
    const p = this.ctx.props;
    for (const key in p) {
      if (!(key in v)) delete p[key];
    }
    Object.assign(p, v);
  }

  constructor(
    public viewFn: ViewFn<Wildcard, Wildcard>,
    public engine: Engine,
    initialProps: Wildcard,
    slot: Wildcard,
    public parent: Maybe<View>,
    public userKey: Maybe<Key>,
  ) {
    this.isPrimitive = (viewFn as Wildcard)[$primitive] === true;

    if (this.isPrimitive) {
      this.stateFlush = noopFlush;
      if (slot != null) {
        // Primitive with children (e.g., div with slot) — needs viewFn for slot
        this.ctx = {
          props: initialProps,
          state: noopState,
          store: noopStore,
          slot,
        };
        this.viewBody = this.viewFn(this.ctx);
      } else {
        // Childless primitive (text, span, td with no slot) — skip viewFn entirely
        this.ctx = {
          props: initialProps,
          state: noopState,
          store: noopStore,
          slot,
        };
        this.viewBody = noopBody;
      }
    } else {
      const { state, flush } = createStateFactory(this);
      this.stateFlush = flush;
      this.ctx = { props: initialProps, state, store: new Store(this), slot };
      this.viewBody = this.viewFn(this.ctx);
    }

    this.api = (this.viewBody as Wildcard).api;
    this.mountBefore();
    this.engine.register(this);
  }

  nextProps(nextProps: Wildcard, nextSlot: Wildcard) {
    if (this.shouldUpdate(nextProps)) {
      this.engine.markNeedRender(this);
    }

    this.ctx.props = nextProps; // setter mutates in-place
    this.ctx.slot = nextSlot;
  }

  [Symbol.dispose]() {
    if (this._disposed) return;
    this._disposed = true;
    // Dispose children first (removes their DOM)
    for (const view of this.virtualDom) {
      view[Symbol.dispose]();
    }
    // Remove own DOM
    this.engine.renderer.unmount(this);
    this.engine.disposeView(this);
    this.parent?.onChildDisposed(this);
    // Clear references to prevent leaks
    this._vdomNode = undefined;
    this._prevDom = undefined;
  }

  shouldUpdate(nextProps: Wildcard): boolean {
    if (this.viewBody.update?.should) {
      return this.viewBody.update.should(nextProps);
    }
    return !shallowEqual(this.props, nextProps);
  }

  mountBefore() {
    this.viewBody.mount?.before?.();
  }

  mountAfter() {
    this.viewBody.mount?.after?.();
  }

  renderBefore() {
    this.engine.renderBefore(this);
    this.viewBody.update?.before?.();
  }

  renderAfter() {
    this.engine.renderAfter(this);
    this.viewBody.update?.after?.();
  }

  disposeChildrenFrom(index: number) {
    for (let i = this.virtualDom.length - 1; i >= index; i--) {
      const view = this.virtualDom.at(i)!;
      view[Symbol.dispose]();
    }
  }

  onChildDisposed(childView: View) {
    this.virtualDom.delete(childView);
    if (childView.userKey) {
      this.keyToView.delete(childView.userKey);
    }
  }

  /** Get the next sibling view via direct linked-list node. O(1). */
  getNextSibling(): Maybe<View> {
    return this._vdomNode?.getNext()?.v;
  }

  /**
   * Match a pending child against the old virtualDom.
   * Returns true if the reused keyed view is at a different position (needs DOM move).
   */
  reconsileChild(
    pending: PendingView,
    index: number,
    newDom: IndexedList<View>,
  ): boolean {
    const orderedView = this.virtualDom.at(index);
    const existingView = pending.userKey
      ? this.keyToView.get(pending.userKey)
      : orderedView;

    if (existingView && existingView.viewFn === pending.viewFn) {
      existingView.nextProps(pending.props, pending.slot);
      existingView._vdomNode = newDom.push(existingView);
      return pending.userKey != null && existingView !== orderedView;
    } else {
      if (existingView) {
        existingView[Symbol.dispose]();
      }
      const view = new View(
        pending.viewFn,
        this.engine,
        pending.props,
        pending.slot,
        this,
        pending.userKey,
      );
      if (pending.userKey) {
        if (this.keyToView === EMPTY_KEY_MAP) this.keyToView = new Map();
        this.keyToView.set(pending.userKey, view);
      }
      view._vdomNode = newDom.push(view);
      return false;
    }
  }

  reconsileChildren(pendingArgs: Set<PendingView>) {
    // Allocate owned structures on first reconciliation (skip for leaf views)
    if (this.virtualDom === EMPTY_VDOM) {
      if (pendingArgs.size === 0) return;
      this.virtualDom = new IndexedList<View>();
      this.keyToView = new Map();
    }

    const oldDom = this.virtualDom;

    // Reuse previous buffer (or allocate on first render)
    const newDom = this._prevDom ?? new IndexedList<View>();
    newDom.clear();

    let moves: View[] | undefined;
    let idx = 0;
    for (const pendingView of pendingArgs) {
      if (this.reconsileChild(pendingView, idx, newDom)) {
        (moves ??= []).push(newDom.last()!);
      }
      idx++;
    }

    // Swap buffers: newDom becomes current, oldDom becomes spare
    this.virtualDom = newDom;

    // Dispose views that weren't matched (in oldDom but not in newDom)
    for (const view of oldDom) {
      if (!newDom.has(view)) {
        view[Symbol.dispose]();
      }
    }

    // Reposition moved views (after newDom is fully built so getNextSibling works)
    if (moves) {
      for (let i = 0; i < moves.length; i++) {
        this.engine.renderer.render(moves[i]!);
      }
    }
    // Clear oldDom before reuse to release references to disposed views
    oldDom.clear();
    this._prevDom = oldDom;
  }

  render() {
    this.stateFlush();
    this.renderBefore();
    this.viewBody.render();
    this.reconsileChildren(this.engine.getPendingViews());
    this.renderAfter();
  }
}
