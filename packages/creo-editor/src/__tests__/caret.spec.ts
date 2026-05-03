import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import {
  blockAbove,
  blockBelow,
  endOfBlock,
  endOfDocAnchor,
  homeOfBlock,
  homeOfDoc,
  nextAnchor,
  prevAnchor,
} from "../controller/navigation";
import { caretAt } from "../controller/selection";
import { docFromBlocks, newBlockId } from "../model/doc";
import type { BlockSpec } from "../model/types";

afterEach(() => {
  clearDom();
});

function buildDoc() {
  const ids = [newBlockId(), newBlockId(), newBlockId()];
  const blocks: BlockSpec[] = [
    { id: ids[0]!, type: "p", runs: [{ text: "hello" }] },
    { id: ids[1]!, type: "p", runs: [{ text: "world" }] },
    { id: ids[2]!, type: "p", runs: [{ text: "" }] },
  ];
  return { ids, doc: docFromBlocks(blocks) };
}

describe("Anchor navigation — char level", () => {
  it("nextAnchor advances within a block", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[0]!, 0);
    const b = nextAnchor(doc, a);
    expect(b.blockId).toBe(ids[0]!);
    expect(b.offset).toBe(1);
  });

  it("nextAnchor crosses to the next block at end of current", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[0]!, "hello".length);
    const b = nextAnchor(doc, a);
    expect(b.blockId).toBe(ids[1]!);
    expect(b.offset).toBe(0);
  });

  it("nextAnchor at end of doc returns the same anchor", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[2]!, 0);
    const b = nextAnchor(doc, a);
    expect(b.blockId).toBe(ids[2]!);
    expect(b.offset).toBe(0);
  });

  it("prevAnchor crosses to previous block at offset 0", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[1]!, 0);
    const b = prevAnchor(doc, a);
    expect(b.blockId).toBe(ids[0]!);
    expect(b.offset).toBe("hello".length);
  });

  it("prevAnchor at start of doc returns the same anchor", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[0]!, 0);
    const b = prevAnchor(doc, a);
    expect(b.blockId).toBe(ids[0]!);
    expect(b.offset).toBe(0);
  });
});

describe("Block-edge navigation", () => {
  it("homeOfBlock collapses to offset 0 of the current block", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[0]!, 3);
    const b = homeOfBlock(doc, a);
    expect(b.offset).toBe(0);
    expect(b.blockId).toBe(ids[0]!);
  });
  it("endOfBlock jumps to the end of the current block", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[0]!, 0);
    const b = endOfBlock(doc, a);
    expect(b.offset).toBe("hello".length);
  });
  it("homeOfDoc / endOfDocAnchor span the whole doc", () => {
    const { ids, doc } = buildDoc();
    expect(homeOfDoc(doc).blockId).toBe(ids[0]!);
    expect(endOfDocAnchor(doc).blockId).toBe(ids[2]!);
  });
  it("blockAbove / blockBelow walk between blocks preserving column", () => {
    const { ids, doc } = buildDoc();
    const a = caretAt(ids[1]!, 3);
    const above = blockAbove(doc, a);
    expect(above.blockId).toBe(ids[0]!);
    expect(above.offset).toBe(3);
    const below = blockBelow(doc, a);
    expect(below.blockId).toBe(ids[2]!);
    // Column 3 clamped to empty block's max (0).
    expect(below.offset).toBe(0);
  });
});

describe("ArrowLeft/Right via input pipeline", () => {
  it("dispatches keydown ArrowRight to advance the caret", () => {
    const root = makeContainer();
    const ids = [newBlockId()];
    const editor = createEditor({
      initial: { blocks: [{ id: ids[0]!, type: "p", runs: [{ text: "abc" }] }] },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    // selStore default: end of doc → offset 3
    expect(editor.selStore.get().kind).toBe("caret");
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;

    // Move to start.
    editor.selStore.set({
      kind: "caret",
      at: caretAt(ids[0]!, 0),
    });
    const press = (key: string, shift = false) => {
      const ev = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        shiftKey: shift,
      });
      ta.dispatchEvent(ev);
    };
    press("ArrowRight");
    let sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(1);
    press("ArrowRight");
    sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(2);
    press("ArrowLeft");
    sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(1);
  });

  it("Shift+Arrow extends a selection", () => {
    const root = makeContainer();
    const ids = [newBlockId()];
    const editor = createEditor({
      initial: { blocks: [{ id: ids[0]!, type: "p", runs: [{ text: "abc" }] }] },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    editor.selStore.set({ kind: "caret", at: caretAt(ids[0]!, 0) });
    const press = (key: string, shift = false) => {
      const ev = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        shiftKey: shift,
      });
      ta.dispatchEvent(ev);
    };
    press("ArrowRight", true);
    press("ArrowRight", true);
    const sel = editor.selStore.get();
    expect(sel.kind).toBe("range");
    if (sel.kind === "range") {
      expect(sel.anchor.offset).toBe(0);
      expect(sel.focus.offset).toBe(2);
    }
  });

  it("Home / End navigate within block", () => {
    const root = makeContainer();
    const ids = [newBlockId()];
    const editor = createEditor({
      initial: { blocks: [{ id: ids[0]!, type: "p", runs: [{ text: "abc" }] }] },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    editor.selStore.set({ kind: "caret", at: caretAt(ids[0]!, 1) });
    const press = (key: string) =>
      ta.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    press("End");
    let sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(3);
    press("Home");
    sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(0);
  });
});
