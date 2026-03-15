import type { Key } from "@/functional/key";
import type { ViewBody, ViewFn } from "@/public/view";
import type { Wildcard } from "./wildcard";
import type { Engine } from "./engine";
import { State } from "@/public/state";
import { Store } from "@/public/store";
import { List } from "@/structures/list";
import { just, type Maybe } from "@/functional/maybe";
import { shallow_equal } from "@/functional/shallow_equal";

export type PendingView = {
  view_fn: ViewFn<Wildcard, Wildcard, Wildcard>;
  props: Wildcard;
  slot: Wildcard;
  user_key: Maybe<Key>;
};

export class View implements Disposable {
  virtual_dom: List<View> = new List<View>([]);
  key_to_view: Map<Key, View> = new Map();
  view_body: ViewBody<Wildcard, Wildcard, Wildcard>;

  constructor(
    public view_fn: ViewFn<Wildcard, Wildcard, Wildcard>,
    public engine: Engine,
    public props: Wildcard,
    public slot: Wildcard,
    public parent: Maybe<View>,
    public user_key: Maybe<Key>,
  ) {
    this.view_body = this.view_fn({
      props,
      state: new State(this),
      store: new Store(this),
      slot,
    });
    this.engine.register(this);
  }

  next_props(next_props: Wildcard, next_slot: Wildcard) {
    if (this.should_update(next_props)) {
      this.engine.mark_need_render(this);
    }

    this.props = next_props;
    this.slot = next_slot;
  }

  [Symbol.dispose]() {
    for (const view of this.virtual_dom) {
      view[Symbol.dispose]();
    }
    this.engine.dispose_view(this);
    this.parent?.on_child_disposed(this);
  }

  should_update(next_props: Wildcard): boolean {
    if (this.view_body.update?.should) {
      return this.view_body.update.should(next_props);
    }
    return shallow_equal(this.props, next_props);
  }

  mount_before() {
    this.view_body.mount?.before?.();
  }

  mount_after() {
    this.view_body.mount?.after?.();
  }

  render_before() {
    this.engine.render_before(this);
    this.view_body.update?.before?.();
  }

  render_after() {
    this.engine.render_after(this);
    this.view_body.update?.after?.();
  }

  dispose_children_from(index: number) {
    for (let i = this.virtual_dom.length - 1; i >= index; i--) {
      const view = this.virtual_dom.at(i);
      just(view);
      view[Symbol.dispose]();
    }
  }

  on_child_disposed(child_view: View) {
    this.virtual_dom.delete(child_view);
    if (child_view.user_key) {
      this.key_to_view.delete(child_view.user_key);
    }
  }

  reconsile_child(pending: PendingView, index: number, new_dom: List<View>) {
    const existing_view = pending.user_key
      ? this.key_to_view.get(pending.user_key)
      : this.virtual_dom.at(index);

    let view: View;
    if (existing_view && existing_view.view_fn === pending.view_fn) {
      const existing_view_index = this.virtual_dom.indexOf(existing_view);
      if (existing_view_index != index) {
        // TODO Handle shifting, when the view is moved to another position
      }
      view = existing_view;
      existing_view.next_props(pending.props, pending.slot);
    } else {
      view = new View(
        pending.view_fn,
        this.engine,
        pending.props,
        pending.slot,
        this,
        pending.user_key,
      );
      if (pending.user_key) {
        this.key_to_view.set(pending.user_key, view);
      }
      if (existing_view) {
        existing_view[Symbol.dispose]();
      }
    }
    new_dom.push(view);
  }

  reconsile_children(pending_args: PendingView[]) {
    const new_dom = new List<View>([]);
    for (let i = 0; i < pending_args.length; i++) {
      const pending = pending_args[i];
      just(pending);
      this.reconsile_child(pending, i, new_dom);
    }
    this.dispose_children_from(pending_args.length);
    this.virtual_dom = new_dom;
  }

  render() {
    this.render_before();
    this.view_body.render();
    this.reconsile_children(this.engine.get_pending_views());
    this.render_after();
  }
}
