import type { Key } from "@/functional/key";
import type { ViewBody, ViewFn } from "@/public/view";
import type { Wildcard } from "./wildcard";
import type { Engine } from "./engine";
import { State } from "@/public/state";
import { Store } from "@/public/store";
import { List } from "@/structures/list";
import { just, type Maybe } from "@/functional/maybe";
import { shallowEqual } from "@/functional/shallow_equal";

export type PendingView = {
  viewFn: ViewFn<Wildcard, Wildcard, Wildcard>;
  props: Wildcard;
  slot: Wildcard;
  userKey: Maybe<Key>;
};

export class View implements Disposable {
  virtualDom: List<View> = new List<View>([]);
  keyToView: Map<Key, View> = new Map();
  viewBody: ViewBody<Wildcard, Wildcard, Wildcard>;

  constructor(
    public viewFn: ViewFn<Wildcard, Wildcard, Wildcard>,
    public engine: Engine,
    public props: Wildcard,
    public slot: Wildcard,
    public parent: Maybe<View>,
    public userKey: Maybe<Key>,
  ) {
    this.viewBody = this.viewFn({
      props,
      state: new State(this),
      store: new Store(this),
      slot,
    });
    this.engine.register(this);
  }

  nextProps(nextProps: Wildcard, nextSlot: Wildcard) {
    if (this.shouldUpdate(nextProps)) {
      this.engine.markNeedRender(this);
    }

    this.props = nextProps;
    this.slot = nextSlot;
  }

  [Symbol.dispose]() {
    for (const view of this.virtualDom) {
      view[Symbol.dispose]();
    }
    this.engine.disposeView(this);
    this.parent?.onChildDisposed(this);
  }

  shouldUpdate(nextProps: Wildcard): boolean {
    if (this.viewBody.update?.should) {
      return this.viewBody.update.should(nextProps);
    }
    return shallowEqual(this.props, nextProps);
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
      const view = this.virtualDom.at(i);
      just(view);
      view[Symbol.dispose]();
    }
  }

  onChildDisposed(childView: View) {
    this.virtualDom.delete(childView);
    if (childView.userKey) {
      this.keyToView.delete(childView.userKey);
    }
  }

  reconsileChild(pending: PendingView, index: number, newDom: List<View>) {
    const existingView = pending.userKey
      ? this.keyToView.get(pending.userKey)
      : this.virtualDom.at(index);

    let view: View;
    if (existingView && existingView.viewFn === pending.viewFn) {
      const existingViewIndex = this.virtualDom.indexOf(existingView);
      if (existingViewIndex != index) {
        // TODO Handle shifting, when the view is moved to another position
      }
      view = existingView;
      existingView.nextProps(pending.props, pending.slot);
    } else {
      view = new View(
        pending.viewFn,
        this.engine,
        pending.props,
        pending.slot,
        this,
        pending.userKey,
      );
      if (pending.userKey) {
        this.keyToView.set(pending.userKey, view);
      }
      if (existingView) {
        existingView[Symbol.dispose]();
      }
    }
    newDom.push(view);
  }

  reconsileChildren(pendingArgs: PendingView[]) {
    const newDom = new List<View>([]);
    for (let i = 0; i < pendingArgs.length; i++) {
      const pending = pendingArgs[i];
      just(pending);
      this.reconsileChild(pending, i, newDom);
    }
    this.disposeChildrenFrom(pendingArgs.length);
    this.virtualDom = newDom;
  }

  render() {
    this.renderBefore();
    this.viewBody.render();
    this.reconsileChildren(this.engine.getPendingViews());
    this.renderAfter();
  }
}
