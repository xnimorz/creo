import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";
import type { InlineRun, Mark } from "../model/types";

afterEach(() => {
  clearDom();
});

function setupWithText(text: string) {
  const root = makeContainer();
  const id = newBlockId();
  const editor = createEditor({
    initial: { blocks: [{ id, type: "p", runs: [{ text }] }] },
  });
  createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
  const ta = root.querySelector(
    "textarea[data-creo-input]",
  ) as HTMLTextAreaElement;
  return { root, editor, id, ta };
}

function getRuns(editor: ReturnType<typeof createEditor>, id: string): InlineRun[] {
  const b = editor.docStore.get().byId.get(id)!;
  if (b.type !== "p") throw new Error("not a paragraph");
  return b.runs;
}

describe("toggleMark", () => {
  it("adds a mark to a single-block range and splits runs", () => {
    const { editor, id } = setupWithText("hello world");
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 0),
      focus: caretAt(id, 5),
    });
    editor.dispatch({ t: "toggleMark", mark: "b" });
    const runs = getRuns(editor, id);
    expect(runs.length).toBe(2);
    expect(runs[0]!.text).toBe("hello");
    expect(runs[0]!.marks?.has("b")).toBe(true);
    expect(runs[1]!.text).toBe(" world");
    expect(runs[1]!.marks ?? new Set()).toEqual(new Set());
  });

  it("removes a mark when the entire range already has it", () => {
    const { editor, id } = setupWithText("hello");
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 0),
      focus: caretAt(id, 5),
    });
    editor.dispatch({ t: "toggleMark", mark: "b" });
    editor.dispatch({ t: "toggleMark", mark: "b" });
    const runs = getRuns(editor, id);
    // After remove, runs should normalize back to a single un-marked run.
    expect(runs.length).toBe(1);
    expect(runs[0]!.text).toBe("hello");
    expect(runs[0]!.marks).toBeUndefined();
  });

  it("partial coverage forces ADD, not remove", () => {
    const { editor, id } = setupWithText("hello world");
    // Bold "hello" first.
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 0),
      focus: caretAt(id, 5),
    });
    editor.dispatch({ t: "toggleMark", mark: "b" });
    // Now select "ello world" — partial coverage of the bold region.
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 1),
      focus: caretAt(id, 11),
    });
    editor.dispatch({ t: "toggleMark", mark: "b" });
    const runs = getRuns(editor, id);
    // Whole range should now be bold; runs reduce to "h" and "ello world".
    let total = "";
    for (const r of runs) total += r.text;
    expect(total).toBe("hello world");
    // every char from offset 1..11 should be bold
    let off = 0;
    for (const r of runs) {
      const start = off;
      const end = off + r.text.length;
      const intersects = !(end <= 1 || start >= 11);
      if (intersects) {
        expect(r.marks?.has("b")).toBe(true);
      }
      off = end;
    }
  });

  it("caret-only toggle is a no-op", () => {
    const { editor, id } = setupWithText("hi");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 1) });
    const before = getRuns(editor, id);
    editor.dispatch({ t: "toggleMark", mark: "b" });
    expect(getRuns(editor, id)).toBe(before);
  });

  it("Cmd+B chord (mac) triggers toggleMark", () => {
    const { editor, id, ta } = setupWithText("hello");
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 0),
      focus: caretAt(id, 5),
    });
    // Detect platform; force one of the two keys.
    const isMacish = /Mac|iPhone|iPod|iPad/i.test(
      (navigator?.platform ?? "") + " " + (navigator?.userAgent ?? ""),
    );
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        bubbles: true,
        cancelable: true,
        ...(isMacish ? { metaKey: true } : { ctrlKey: true }),
      }),
    );
    const runs = getRuns(editor, id);
    expect(runs[0]!.marks?.has("b" as Mark)).toBe(true);
  });

  it("Property: random toggle sequences converge to canonical run sets", () => {
    // Generate text "abcdefghij" and toggle marks over random sub-ranges.
    // After all toggles, walk the runs and verify (a) every run's marks set
    // is consistent with its text segment, (b) adjacent runs never share an
    // identical marks set (else normalization should have merged them).
    const { editor, id } = setupWithText("abcdefghij");
    const marks: Mark[] = ["b", "i", "u", "s"];
    for (let trial = 0; trial < 200; trial++) {
      const a = Math.floor(Math.random() * 11);
      const b = Math.floor(Math.random() * 11);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      if (start === end) continue;
      const m = marks[Math.floor(Math.random() * marks.length)]!;
      editor.selStore.set({
        kind: "range",
        anchor: caretAt(id, start),
        focus: caretAt(id, end),
      });
      editor.dispatch({ t: "toggleMark", mark: m });
    }
    const runs = getRuns(editor, id);
    let total = "";
    for (const r of runs) total += r.text;
    expect(total).toBe("abcdefghij");
    // Adjacent normalization invariant.
    for (let i = 1; i < runs.length; i++) {
      const a = runs[i - 1]!.marks ?? new Set();
      const b = runs[i]!.marks ?? new Set();
      const sameSize = a.size === b.size;
      let same = sameSize;
      if (sameSize) {
        for (const x of a) if (!b.has(x)) { same = false; break; }
      }
      expect(same).toBe(false);
    }
  });
});
