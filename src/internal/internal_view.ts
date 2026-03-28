import type { Key } from "@/functional/key";
import type { Children, Slot, ViewBody, ViewFn } from "@/public/view";
import type { Engine } from "./engine";
import { State, type Reactive } from "@/public/state";
import { Store, isStore } from "@/public/store";
import { IndexedList } from "@/structures/indexed_list";
import { shallowEqual } from "@/functional/shallow_equal";
import type { Maybe } from "@/functional/maybe";
import type { Wildcard } from "./wildcard";

export type PendingView<Props = Wildcard, Api = Wildcard> = {
  viewFn: ViewFn<Props, Api>;
  props: Props;
  slot: Maybe<Slot>;
  userKey: Maybe<Key>;
};

export class View<Props = Wildcard, Api = Wildcard> implements Disposable {
  // Renderer matched details (depends on each renderer)
  // TODO: need to be typed better
  renderRef: unknown;

  // Props
  props: Props;

  // Children received from slot
  slotChildren: Children;

  // User defined View APIs
  body: ViewBody<Props, Api>;

  // VDom elements: structure & user-key mapper
  virtualDom: Maybe<IndexedList<View>>;
  keyToIndex: Maybe<Map<Key, number>>;

  // marks if the entity itself needs rerender
  dirty: boolean = true;

  #unsubscribe: (() => void)[] = [];

  constructor(
    public viewFn: ViewFn<Props, Api>,
    initialProps: Props,
    slot: Maybe<Slot>,
    public engine: Engine,
    public parent: Maybe<View>,
    public userKey: Maybe<Key>,
  ) {
    this.props = initialProps;

    this.body = viewFn({
      props: () => this.props,

      use: <T>(storeOrInitial: T | Store<T>): Reactive<T> => {
        if (!isStore(storeOrInitial)) {
          // Local state
          return new State(storeOrInitial, this.markDirty);
        }

        // Store operation
        const s = storeOrInitial;
        this.#unsubscribe.push(this.markDirty);
        return s;
      },

      slot: () => {
        if (!this.slotChildren) {
          return;
        }
        for (const child of this.slotChildren) {
          this.engine.pendingView(child);
        }
      },
    });

    this.slotChildren = slot && this.engine.collect(slot);
    this.markDirty();
  }

  markDirty = () => {
    this.dirty = true;
    this.engine.markDirty(this);
  };

  markMoved() {
    this.engine.markDirty(this);
  }

  shouldUpdate(nextProps: Props): boolean {
    if (this.body.shouldUpdate) {
      return this.body.shouldUpdate(nextProps);
    }
    return !shallowEqual(this.props, nextProps);
  }

  onMount = () => {
    this.body.onMount?.();
  };

  onUpdateBefore() {
    this.body.onUpdateBefore?.();
  }

  onUpdateAfter = () => {
    this.body.onUpdateBefore?.();
  };

  nextProps(nextProps: Props, nextSlot: Maybe<Slot>) {
    const prevChildren = this.slotChildren;
    this.slotChildren = nextSlot && this.engine.collect(nextSlot);

    if (
      this.shouldUpdate(nextProps) ||
      hasNewChildren(prevChildren, this.slotChildren)
    ) {
      this.markDirty();
      this.props = nextProps;
    }
  }

  reconsile() {
    const children = this.engine.collect(this.body.render);
    if (!this.virtualDom && children.length === 0) return;
    if (!this.virtualDom) this.virtualDom = new IndexedList();
    const vdom = this.virtualDom;

    for (let i = 0; i < children.length; i++) {
      const pending = children[i]!;
      const expectedNext = vdom.at(i);
      // Non-keyed operation
      if (pending.userKey == null) {
        if (expectedNext?.viewFn === pending.viewFn) {
          expectedNext.nextProps(pending.props, pending.slot);
        } else {
          if (expectedNext) {
            if (expectedNext.userKey)
              this.keyToIndex?.delete(expectedNext.userKey);
            expectedNext[Symbol.dispose]();
          }
          vdom.upsert(
            i,
            new View(
              pending.viewFn,
              pending.props,
              pending.slot,
              this.engine,
              this,
              null, // no user key
            ),
          );
        }
      } else {
        // Keyed operation
        // TODO
        // We need to somehow handle case where keyed elements are mixed with non keyed and then repeated with same keys.
        // We likely need keyed groups, following separate reconsiliation
        const matchedIndex = this.keyToIndex?.get(pending.userKey);
        const matched = matchedIndex != null ? vdom.at(matchedIndex) : null;
        if (matched && matched.viewFn === pending.viewFn) {
          matched.nextProps(pending.props, pending.slot);

          // We have some element in expectedNext. Need to identify actions
          if (expectedNext != null) {
            // We have non-matched element in expectedNext, we need to swap them
            if (matched !== expectedNext) {
              matched.markMoved();
              expectedNext.markMoved();
              vdom.swap(matched, expectedNext);
              // Update keyToIndex after swap: matched is now at i, expectedNext at matchedIndex
              if (this.keyToIndex) {
                if (matched.userKey != null)
                  this.keyToIndex.set(matched.userKey, i);
                if (expectedNext.userKey != null)
                  this.keyToIndex.set(expectedNext.userKey, matchedIndex!);
              }
            }
            // elements matched, all good
          } else {
            // No element in expectedNext, we just need to put matched to correct position.
            // TODO:
            // technically this case should NOT be possible, as we have matched item, while exceeding the array size already.
            matched.markMoved();
            vdom.upsert(i, matched);
            if (this.keyToIndex && matched.userKey != null) {
              this.keyToIndex.set(matched.userKey, i);
            }
          }
        } else {
          if (expectedNext) {
            if (expectedNext.userKey)
              this.keyToIndex?.delete(expectedNext.userKey);
            expectedNext[Symbol.dispose]();
          }
          // No matched element, we need to create new one and put it to correct position
          vdom.upsert(
            i,
            new View(
              pending.viewFn,
              pending.props,
              pending.slot,
              this.engine,
              this,
              pending.userKey,
            ),
          );

          if (!this.keyToIndex) this.keyToIndex = new Map();
          this.keyToIndex.set(pending.userKey, i);
        }
      }
    }

    // Cleanup removed nodes
    if (children.length < vdom.length) {
      for (let i = vdom.length; i >= children.length; i--) {
        const removed = vdom.at(i);
        if (removed) {
          if (removed.userKey) this.keyToIndex?.delete(removed.userKey);
          removed[Symbol.dispose]();
          vdom.delete(removed);
        }
      }
    }
  }

  [Symbol.dispose]() {
    if (this.virtualDom) {
      for (const child of this.virtualDom) {
        child[Symbol.dispose]();
      }
    }
    this.engine.renderer.unmount(this);

    this.engine.disposeView(this);
  }
}

/** True if nextChildren differ from prev (structure or props). */
function hasNewChildren(
  prev: Maybe<PendingView[]>,
  next: Maybe<PendingView[]>,
): boolean {
  const prevLen = prev?.length ?? 0;
  const nextLen = next?.length ?? 0;
  if (prevLen === 0 && nextLen === 0) return false;
  if (!prev || !next) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    if (next[i]!.viewFn !== prev[i]!.viewFn) return true;
    if (next[i]!.userKey !== prev[i]!.userKey) return true;
    if (next[i]!.props !== prev[i]!.props) return true;
  }
  return false;
}
