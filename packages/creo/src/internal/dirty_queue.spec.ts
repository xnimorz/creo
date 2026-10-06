import { describe, it, expect } from "bun:test";
import { view } from "@/public/view";
import { div, text } from "@/public/primitives/primitives";
import { store } from "@/public/store";
import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlStringRender } from "@/render/string_render";

// Regression: a child re-marked dirty after the loop passed it was dropped, leaving F_DIRTY set with no queue entry.
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
            // Fresh props → parent's reconcile re-marks the child
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

    // Child queued first
    feed.set({ value: "two" });
    bump();
    engine.render();
    expect(renderer.renderToString()).toContain("two");

    feed.set({ value: "three" });
    engine.render();
    expect(renderer.renderToString()).toContain("three");
  });
});
