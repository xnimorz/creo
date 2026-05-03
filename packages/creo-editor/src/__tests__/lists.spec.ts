import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";
import type { ListItemBlock } from "../model/types";

afterEach(() => {
  clearDom();
});

// Synchronous scheduler so DOM assertions don't have to wait for the
// microtask queue.
const SYNC = { scheduler: (cb: () => void) => cb() };

function multi(text: string[]) {
  const ids = text.map(() => newBlockId());
  return {
    ids,
    blocks: text.map((t, i) => ({
      id: ids[i]!,
      type: "p" as const,
      runs: [{ text: t }],
    })),
  };
}

describe("List commands", () => {
  it("toggleList(false) converts paragraph(s) to <li> and groups them in <ul>", () => {
    const root = makeContainer();
    const { ids, blocks } = multi(["one", "two", "three"]);
    const editor = createEditor({ initial: { blocks } });
    createApp(() => editor.EditorView(), new HtmlRender(root), SYNC).mount();
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(ids[0]!, 0),
      focus: caretAt(ids[2]!, 0),
    });
    editor.dispatch({ t: "toggleList", ordered: false });
    const doc = editor.docStore.get();
    for (const id of ids) {
      const b = doc.byId.get(id)!;
      expect(b.type).toBe("li");
      if (b.type === "li") {
        expect(b.ordered).toBe(false);
        expect(b.depth).toBe(0);
      }
    }
    // DOM grouping — DocView wraps adjacent <li> blocks in <ul>.
    const ul = root.querySelector("ul.ce-list");
    expect(ul).toBeTruthy();
    expect(ul!.querySelectorAll("li[data-block-id]").length).toBe(3);
  });

  it("toggleList(false) twice demotes back to paragraphs", () => {
    const root = makeContainer();
    const { ids, blocks } = multi(["one", "two"]);
    const editor = createEditor({ initial: { blocks } });
    createApp(() => editor.EditorView(), new HtmlRender(root), SYNC).mount();
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(ids[0]!, 0),
      focus: caretAt(ids[1]!, 0),
    });
    editor.dispatch({ t: "toggleList", ordered: false });
    editor.dispatch({ t: "toggleList", ordered: false });
    const doc = editor.docStore.get();
    for (const id of ids) {
      expect(doc.byId.get(id)!.type).toBe("p");
    }
  });

  it("ordered + unordered groups don't merge", () => {
    const root = makeContainer();
    const { ids, blocks } = multi(["a", "b", "c"]);
    const editor = createEditor({ initial: { blocks } });
    createApp(() => editor.EditorView(), new HtmlRender(root), SYNC).mount();
    // First two → unordered
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(ids[0]!, 0),
      focus: caretAt(ids[1]!, 0),
    });
    editor.dispatch({ t: "toggleList", ordered: false });
    // Last → ordered
    editor.selStore.set({ kind: "caret", at: caretAt(ids[2]!, 0) });
    editor.dispatch({ t: "toggleList", ordered: true });

    expect(root.querySelectorAll("ul.ce-list").length).toBe(1);
    expect(root.querySelectorAll("ol.ce-list").length).toBe(1);
    const ul = root.querySelector("ul.ce-list")!;
    const ol = root.querySelector("ol.ce-list")!;
    expect(ul.querySelectorAll("li[data-block-id]").length).toBe(2);
    expect(ol.querySelectorAll("li[data-block-id]").length).toBe(1);
  });

  it("Tab indents list items; Shift+Tab outdents and finally demotes to <p>", () => {
    const root = makeContainer();
    const { ids, blocks } = multi(["a"]);
    const editor = createEditor({ initial: { blocks } });
    createApp(() => editor.EditorView(), new HtmlRender(root), SYNC).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    editor.selStore.set({ kind: "caret", at: caretAt(ids[0]!, 0) });
    editor.dispatch({ t: "toggleList", ordered: false });

    const press = (key: string, shift = false) =>
      ta.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
          shiftKey: shift,
        }),
      );
    press("Tab");
    let li = editor.docStore.get().byId.get(ids[0]!) as ListItemBlock;
    expect(li.depth).toBe(1);
    press("Tab");
    li = editor.docStore.get().byId.get(ids[0]!) as ListItemBlock;
    expect(li.depth).toBe(2);
    press("Tab", true);
    li = editor.docStore.get().byId.get(ids[0]!) as ListItemBlock;
    expect(li.depth).toBe(1);
    press("Tab", true);
    li = editor.docStore.get().byId.get(ids[0]!) as ListItemBlock;
    expect(li.depth).toBe(0);
    // Outdent at depth 0 → demote to paragraph.
    press("Tab", true);
    expect(editor.docStore.get().byId.get(ids[0]!)!.type).toBe("p");
  });

  it("Enter inside a list item creates a new list item of the same kind", () => {
    const root = makeContainer();
    const { ids, blocks } = multi(["item one"]);
    const editor = createEditor({ initial: { blocks } });
    createApp(() => editor.EditorView(), new HtmlRender(root), SYNC).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    editor.selStore.set({ kind: "caret", at: caretAt(ids[0]!, 8) });
    editor.dispatch({ t: "toggleList", ordered: true });
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    const a = doc.byId.get(doc.order[0]!) as ListItemBlock;
    const b = doc.byId.get(doc.order[1]!) as ListItemBlock;
    expect(a.type).toBe("li");
    expect(b.type).toBe("li");
    expect(a.ordered).toBe(true);
    expect(b.ordered).toBe(true);
  });
});
