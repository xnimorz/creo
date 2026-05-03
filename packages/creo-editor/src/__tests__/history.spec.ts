import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";

afterEach(() => clearDom());

function setup(text = "hello") {
  const root = makeContainer();
  const id = newBlockId();
  const editor = createEditor({
    initial: { blocks: [{ id, type: "p", runs: [{ text }] }] },
  });
  createApp(
    () => editor.EditorView(),
    new HtmlRender(root),
    SYNC_SCHEDULER,
  ).mount();
  return { root, editor, id };
}

describe("Undo / redo", () => {
  it("undo restores the doc + selection before the last command", () => {
    const { editor, id } = setup("hello");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 5) });
    editor.dispatch({ t: "insertText", text: "!" });
    expect(blockText(editor, id)).toBe("hello!");
    editor.undo();
    expect(blockText(editor, id)).toBe("hello");
    const sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(5);
  });

  it("redo replays an undone command", () => {
    const { editor, id } = setup("hi");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 2) });
    editor.dispatch({ t: "insertText", text: "!" });
    editor.undo();
    editor.redo();
    expect(blockText(editor, id)).toBe("hi!");
  });

  it("multiple consecutive insertText collapse into one undo entry", () => {
    const { editor, id } = setup("");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 0) });
    editor.dispatch({ t: "insertText", text: "h" });
    editor.dispatch({ t: "insertText", text: "i" });
    editor.dispatch({ t: "insertText", text: "!" });
    expect(blockText(editor, id)).toBe("hi!");
    editor.undo();
    // Coalesce: one undo wipes ALL three keystrokes.
    expect(blockText(editor, id)).toBe("");
  });

  it("undo at empty stack is a no-op", () => {
    const { editor, id } = setup("hi");
    editor.undo();
    expect(blockText(editor, id)).toBe("hi");
  });

  it("non-text commands do not coalesce", () => {
    const { editor, id } = setup("hello world");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 6) });
    editor.dispatch({ t: "splitBlock" });
    editor.dispatch({ t: "splitBlock" });
    expect(editor.docStore.get().order.length).toBe(3);
    editor.undo();
    expect(editor.docStore.get().order.length).toBe(2);
    editor.undo();
    expect(editor.docStore.get().order.length).toBe(1);
  });

  it("a new edit invalidates the redo stack", () => {
    const { editor, id } = setup("hi");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 2) });
    editor.dispatch({ t: "insertText", text: "!" });
    editor.undo();
    editor.dispatch({ t: "insertText", text: "?" });
    editor.redo();
    // redo had nothing to do — the "?" stays.
    expect(blockText(editor, id)).toBe("hi?");
  });

  it("setDocFromHTML clears history", () => {
    const { editor, id } = setup("hi");
    editor.dispatch({ t: "insertText", text: "!" });
    editor.setDocFromHTML("<p>fresh</p>");
    editor.undo();
    // doc still shows the new content — undo couldn't roll back past reset.
    let txt = "";
    const doc = editor.docStore.get();
    for (const bid of doc.order) {
      const b = doc.byId.get(bid)!;
      if (b.type === "p") for (const r of b.runs) txt += r.text;
    }
    expect(txt).toBe("fresh");
    void id;
  });
});

function blockText(editor: ReturnType<typeof createEditor>, id: string): string {
  const b = editor.docStore.get().byId.get(id)!;
  if (b.type !== "p") return "";
  let s = "";
  for (const r of b.runs) s += r.text;
  return s;
}
