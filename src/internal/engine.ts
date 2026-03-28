import type { IRender } from "@/render/render_interface";
import type { View, PendingView } from "./internal_view";
import { IndexedList } from "@/structures/indexed_list";
import type { Wildcard } from "./wildcard";
import type { Maybe } from "@/functional/maybe";

export type Scheduler = (callback: () => void) => void;

export class Engine {
  dirty = new IndexedList<View>();
  #scheduler: Scheduler;

  #renderScheduled = false;

  #collector: Maybe<(view: PendingView) => void>;

  constructor(
    public renderer: IRender<Wildcard>,
    scheduler?: Scheduler,
  ) {
    this.#scheduler =
      (scheduler ?? "scheduler" in globalThis)
        ? // @ts-ignore
          (cb) => window.scheduler.postTask(cb)
        : (cb) => queueMicrotask(cb);
  }

  disposeView(view: View) {
    this.dirty.delete(view);
  }

  schedule() {
    if (this.#renderScheduled) {
      return;
    }

    this.#renderScheduled = true;
    this.#scheduler(() => {
      this.#renderScheduled = false;
      this.render();
    });
  }

  /** Mark a view dirty and schedule a render loop if not already scheduled. */
  markDirty(view: View) {
    this.dirty.push(view);
    this.schedule();
  }

  pendingView(view: PendingView) {
    this.#collector?.(view);
  }

  collect(slot: () => void): PendingView[] {
    const list: PendingView[] = [];
    const prev = this.#collector;
    this.#collector = list.push.bind(list);
    slot();
    this.#collector = prev;
    return list;
  }

  #rendering = false;
  render() {
    if (this.#rendering) return;

    this.#rendering = true;
    try {
      const cbs: (() => void)[] = [];

      while (this.dirty.length > 0) {
        const view = this.dirty.first()!;
        const isNew = view.renderRef == null;

        if (!isNew) view.onUpdateBefore();

        // Physical render. Might need to have separate queue for this.
        this.renderer.render(view);

        if (view.dirty) {
          // Reconsiling view to prepare their children & vdom
          view.reconsile();
          cbs.push(isNew ? view.onMount : view.onUpdateAfter);
          view.dirty = false; // view is renrendered at this stage
        }

        this.dirty.delete(view);
      }

      for (const cb of cbs) {
        cb();
      }
    } finally {
      this.#rendering = false;
    }
  }
}
