import { describe, it, expect } from "bun:test";
import { view } from "@/public/view";
import { div, text } from "@/public/primitives/primitives";
import { store } from "@/public/store";
import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlStringRender } from "@/render/string_render";

/**
 * Regression: a view re-marked dirty after the render loop's Set iterator has
 * already walked past it used to be dropped by the trailing `clear()`, and
 * stayed dropped forever — F_DIRTY set with no queue entry makes every later
 * markDirty early-return.
 *
 * Sequence: child and parent are both queued, child first (its store fired,
 * then the parent's state changed). The loop renders the child and clears
 * F_DIRTY, then reaches the parent, whose reconcile re-marks the child because
 * the props are not shallow-equal.
 */
describe("dirty queue", () => {
  it("keeps a store subscriber live after the parent re-marks it mid-pass", () => {
    const feed = store.new({ value: "one" });
    let bump: () => void = () => {};

    const Child = view<{ tick: number }>(({ use }) => {
      const s = use(feed);
      return {
        render() {
          div({ class: "child" }, () => {
            text(s.get().value);
          });
        },
      };
    });

    const Parent = view(({ use }) => {
      const tick = use(0);
      bump = () => tick.set(tick.get() + 1);
      return {
        render() {
          div({ class: "parent" }, () => {
            // Fresh props object every render, so shallowEqual fails and the
            // parent's reconcile re-marks the child.
            Child({ tick: tick.get() });
          });
        },
      };
    });

    const renderer = new HtmlStringRender();
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    engine.createRoot(() => {
      Parent();
    }, {});
    engine.render();
    expect(renderer.renderToString()).toContain("one");

    // Both land in the queue before the render runs, child first.
    feed.set({ value: "two" });
    bump();
    engine.render();
    expect(renderer.renderToString()).toContain("two");

    // Used to fail: the child was stuck with F_DIRTY set and unqueued.
    feed.set({ value: "three" });
    engine.render();
    expect(renderer.renderToString()).toContain("three");
  });
});
