import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";

afterEach(() => {
  clearDom();
});

function mountWith(text: string) {
  const root = makeContainer();
  const id = newBlockId();
  const editor = createEditor({
    initial: { blocks: [{ id, type: "p", runs: [{ text }] }] },
  });
  createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
  const ta = root.querySelector(
    "textarea[data-creo-input]",
  ) as HTMLTextAreaElement;
  return {
    root,
    editor,
    ta,
    id,
    press: (key: string) =>
      ta.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      ),
  };
}

describe("Structural commands", () => {
  it("Enter splits a block at the caret — left + right halves", () => {
    const { editor, press, id } = mountWith("hello world");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 6) });
    press("Enter");
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    const a = doc.byId.get(doc.order[0]!)!;
    const b = doc.byId.get(doc.order[1]!)!;
    expect(a.type).toBe("p");
    expect(b.type).toBe("p");
    if (a.type === "p" && b.type === "p") {
      expect(a.runs[0]!.text).toBe("hello ");
      expect(b.runs[0]!.text).toBe("world");
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.blockId).toBe(doc.order[1]!);
      expect(sel.at.offset).toBe(0);
    }
  });

  it("Enter at end of block creates an empty paragraph", () => {
    const { editor, press, id } = mountWith("hello");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 5) });
    press("Enter");
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    const tail = doc.byId.get(doc.order[1]!)!;
    expect(tail.type).toBe("p");
    if (tail.type === "p") expect(tail.runs.length).toBe(0);
  });

  it("Enter on a heading splits into a paragraph", () => {
    const root = makeContainer();
    const id = newBlockId();
    const editor = createEditor({
      initial: { blocks: [{ id, type: "h2", runs: [{ text: "Heading" }] }] },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    editor.selStore.set({ kind: "caret", at: caretAt(id, "Heading".length) });
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    expect(doc.byId.get(doc.order[0]!)!.type).toBe("h2");
    expect(doc.byId.get(doc.order[1]!)!.type).toBe("p");
  });

  it("Backspace at offset 0 merges with the previous block", () => {
    const { editor, press, id } = mountWith("hello world");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 6) });
    press("Enter");
    let doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    // Caret now at start of second block.
    press("Backspace");
    doc = editor.docStore.get();
    expect(doc.order.length).toBe(1);
    const merged = doc.byId.get(doc.order[0]!)!;
    if (merged.type === "p") {
      expect(merged.runs[0]!.text).toBe("hello world");
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(6);
  });

  it("Delete at end of block merges with the next block", () => {
    const { editor, press, id } = mountWith("hello world");
    editor.selStore.set({ kind: "caret", at: caretAt(id, 6) });
    press("Enter");
    let doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    // Caret is at start of second block — move back to end of first
    editor.selStore.set({
      kind: "caret",
      at: caretAt(doc.order[0]!, 6),
    });
    press("Delete");
    doc = editor.docStore.get();
    expect(doc.order.length).toBe(1);
    const merged = doc.byId.get(doc.order[0]!)!;
    if (merged.type === "p") {
      expect(merged.runs[0]!.text).toBe("hello world");
    }
  });

  it("setBlockType promotes a paragraph to a heading and back", () => {
    const { editor, id } = mountWith("title");
    editor.dispatch({
      t: "setBlockType",
      payload: { type: "h1" },
    });
    let doc = editor.docStore.get();
    expect(doc.byId.get(id)!.type).toBe("h1");
    editor.dispatch({ t: "setBlockType", payload: { type: "p" } });
    doc = editor.docStore.get();
    expect(doc.byId.get(id)!.type).toBe("p");
  });

  it("Cross-block range delete (Backspace with selection across blocks)", () => {
    const root = makeContainer();
    const ids = [newBlockId(), newBlockId(), newBlockId()];
    const editor = createEditor({
      initial: {
        blocks: [
          { id: ids[0]!, type: "p", runs: [{ text: "hello" }] },
          { id: ids[1]!, type: "p", runs: [{ text: "lost" }] },
          { id: ids[2]!, type: "p", runs: [{ text: "world" }] },
        ],
      },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    // Range from ids[0]:3 → ids[2]:2  (covers "lo|hello" tail + middle block + "wo|rld" head)
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(ids[0]!, 3),
      focus: caretAt(ids[2]!, 2),
    });
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        cancelable: true,
      }),
    );
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(1);
    const merged = doc.byId.get(doc.order[0]!)!;
    if (merged.type === "p") {
      expect(merged.runs[0]!.text).toBe("helrld");
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.blockId).toBe(ids[0]!);
      expect(sel.at.offset).toBe(3);
    }
  });

  it("Heading view renders the right HTML tag", () => {
    const root = makeContainer();
    const id = newBlockId();
    const editor = createEditor({
      initial: { blocks: [{ id, type: "h3", runs: [{ text: "section" }] }] },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    const h = root.querySelector(`h3[data-block-id="${id}"]`);
    expect(h).toBeTruthy();
    expect(h!.textContent).toBe("section");
  });
});
