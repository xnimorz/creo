import { afterEach, describe, expect, it } from "bun:test";
import "../../__tests__/setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "../../__tests__/setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../../createEditor";
import {
  __resetCoarsePointerCache,
  __testTimings,
  attachTouchClassifier,
  isCoarsePointer,
} from "../mobile";

afterEach(() => {
  clearDom();
  __resetCoarsePointerCache();
});

function pdown(target: EventTarget, x: number, y: number, isPrimary = true) {
  const ev = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clientX", { value: x });
  Object.defineProperty(ev, "clientY", { value: y });
  Object.defineProperty(ev, "isPrimary", { value: isPrimary });
  target.dispatchEvent(ev);
}
function pmove(target: EventTarget, x: number, y: number) {
  const ev = new Event("pointermove", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clientX", { value: x });
  Object.defineProperty(ev, "clientY", { value: y });
  target.dispatchEvent(ev);
}
function pup(target: EventTarget, x: number, y: number) {
  const ev = new Event("pointerup", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clientX", { value: x });
  Object.defineProperty(ev, "clientY", { value: y });
  target.dispatchEvent(ev);
}

describe("Mobile gesture classifier", () => {
  it("classifies a quick pointer-down/up with no movement as a tap", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();

    let taps = 0;
    let longPresses = 0;
    let focused = 0;
    const handle = attachTouchClassifier(
      root,
      { docStore: editor.docStore, selStore: editor.selStore },
      {
        onTap: () => taps++,
        onLongPress: () => longPresses++,
        focusInput: () => focused++,
      },
    );
    pdown(root, 50, 50);
    pup(root, 50, 50);
    expect(taps).toBe(1);
    expect(longPresses).toBe(0);
    expect(focused).toBe(1);
    handle.destroy();
  });

  it("classifies movement past 8px as a scroll (no tap, no long-press)", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    let taps = 0;
    let longPresses = 0;
    const handle = attachTouchClassifier(
      root,
      { docStore: editor.docStore, selStore: editor.selStore },
      { onTap: () => taps++, onLongPress: () => longPresses++ },
    );
    pdown(root, 50, 50);
    pmove(root, 50, 70); // 20px down — clearly above 8px threshold
    pup(root, 50, 70);
    expect(taps).toBe(0);
    expect(longPresses).toBe(0);
    handle.destroy();
  });

  it("fires long-press after 500ms with no movement", async () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    let longPresses = 0;
    const handle = attachTouchClassifier(
      root,
      { docStore: editor.docStore, selStore: editor.selStore },
      { onLongPress: () => longPresses++ },
    );
    pdown(root, 50, 50);
    await new Promise((r) =>
      setTimeout(r, __testTimings.LONG_PRESS_MS + 50),
    );
    expect(longPresses).toBe(1);
    pup(root, 50, 50);
    handle.destroy();
  });

  it("non-primary pointer is ignored", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    let taps = 0;
    const handle = attachTouchClassifier(
      root,
      { docStore: editor.docStore, selStore: editor.selStore },
      { onTap: () => taps++ },
    );
    pdown(root, 10, 10, /*isPrimary*/ false);
    pup(root, 10, 10);
    expect(taps).toBe(0);
    handle.destroy();
  });
});

describe("isCoarsePointer", () => {
  it("returns false on a desktop-like environment by default", () => {
    // happy-dom defaults — no coarse pointer.
    expect(isCoarsePointer()).toBe(false);
  });
});
