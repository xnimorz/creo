import { afterEach, describe, expect, it } from "bun:test";
import "../../__tests__/setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "../../__tests__/setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../../createEditor";
import { newBlockId } from "../../model/doc";
import type { BlockSpec } from "../../model/types";

afterEach(() => clearDom());

function bigDoc(n: number): { ids: string[]; blocks: BlockSpec[] } {
  const ids = Array.from({ length: n }, () => newBlockId());
  const blocks: BlockSpec[] = ids.map((id, i) => ({
    id,
    type: "p",
    runs: [{ text: `paragraph ${i}` }],
  }));
  return { ids, blocks };
}

describe("VirtualDoc", () => {
  it("with a small viewport, only a window of blocks is in the DOM", () => {
    // Stub viewport at 240px and estimated 30px → ~8 blocks * (1 + 1.5*2)
    // overscan ≈ 32 visible. We fix viewportHeight via createEditor opts.
    const root = makeContainer();
    const { blocks } = bigDoc(500);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
      virtualized: true,
      virtualEstimatedHeight: 30,
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();

    const ps = root.querySelectorAll("p[data-block-id]");
    // 500 paragraphs would normally be 500 <p> nodes; virtualized should
    // mount at most ~few hundred (default viewport). Just assert it's
    // strictly less than the total.
    expect(ps.length).toBeLessThan(500);
    expect(ps.length).toBeGreaterThan(0);
  });

  it("does NOT mount blocks far outside the viewport", () => {
    const root = makeContainer();
    const { ids, blocks } = bigDoc(2000);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
      virtualized: true,
      virtualEstimatedHeight: 20,
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    // A block 1500 entries deep is way past the rendered window.
    const farId = ids[1500]!;
    expect(root.querySelector(`p[data-block-id="${farId}"]`)).toBeFalsy();
    // The first block (index 0) is mounted.
    expect(root.querySelector(`p[data-block-id="${ids[0]}"]`)).toBeTruthy();
  });

  it("renders top + bottom spacer divs to absorb off-screen height", () => {
    const root = makeContainer();
    const { blocks } = bigDoc(200);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
      virtualized: true,
      virtualEstimatedHeight: 30,
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    const vroot = root.querySelector(".creo-vroot");
    expect(vroot).toBeTruthy();
    // At least one of the two spacers should exist (top: 0 if scrollTop=0,
    // but bottom should be non-zero with 200 blocks of 30px each).
    const bottom = root.querySelector(".creo-vspacer-bottom");
    expect(bottom).toBeTruthy();
  });
});
