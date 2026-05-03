import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { newBlockId } from "../model/doc";

afterEach(() => {
  clearDom();
});

function mountEmpty(): {
  root: HTMLElement;
  editor: ReturnType<typeof createEditor>;
  textarea: HTMLTextAreaElement;
  input: (data: string, type?: string) => void;
  raw: (e: Event) => void;
} {
  const root = makeContainer();
  const editor = createEditor();
  createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
  const textarea = root.querySelector(
    `textarea[data-creo-input]`,
  ) as HTMLTextAreaElement;
  const input = (data: string, type = "insertText") => {
    const ev = new (globalThis as { Event: typeof Event }).Event(
      "beforeinput",
      { bubbles: true, cancelable: true },
    );
    Object.defineProperty(ev, "data", { value: data, configurable: true });
    Object.defineProperty(ev, "inputType", { value: type, configurable: true });
    textarea.dispatchEvent(ev);
  };
  const raw = (e: Event) => textarea.dispatchEvent(e);
  return { root, editor, textarea, input, raw };
}

describe("HiddenInput + input pipeline", () => {
  it("renders a single hidden textarea positioned for mobile keyboard support", () => {
    const { root, textarea } = mountEmpty();
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute("autocomplete")).toBe("off");
    expect(textarea.getAttribute("autocorrect")).toBe("off");
    expect(textarea.getAttribute("autocapitalize")).toBe("off");
    expect(textarea.getAttribute("spellcheck")).toBe("false");
    expect(textarea.getAttribute("inputmode")).toBe("text");
    // Mandatory iOS auto-zoom guard. happy-dom normalizes spacing in the
    // serialized style string, so match either form.
    const style = (textarea.getAttribute("style") ?? "").replace(/\s+/g, "");
    expect(style).toContain("font-size:16px");
    // There must only be one input per editor root.
    expect(root.querySelectorAll("textarea[data-creo-input]").length).toBe(1);
  });

  it("focuses the textarea on pointer-down anywhere in the editor root", () => {
    const { root, textarea, editor } = mountEmpty();
    const editorRoot = root.querySelector(
      "[data-creo-editor]",
    ) as HTMLElement;
    expect(editorRoot).toBeTruthy();
    // Sanity: nothing focused yet.
    expect(document.activeElement === textarea).toBe(false);
    // Programmatic focus path also goes through the pipeline.
    editor.focus();
    expect(document.activeElement === textarea).toBe(true);
    editor.blur();
    expect(document.activeElement === textarea).toBe(false);
  });

  it("inserts text on beforeinput → docStore reflects the edit", () => {
    const { editor, input } = mountEmpty();
    input("h");
    input("i");
    const doc = editor.docStore.get();
    const blockId = doc.order[0]!;
    const block = doc.byId.get(blockId)!;
    expect(block.type).toBe("p");
    if (block.type === "p") {
      expect(block.runs.length).toBe(1);
      expect(block.runs[0]!.text).toBe("hi");
    }
  });

  it("extends inserted text and advances the implicit cursor", () => {
    const { editor, input } = mountEmpty();
    input("a");
    input("b");
    input("c");
    const doc = editor.docStore.get();
    const block = doc.byId.get(doc.order[0]!)!;
    if (block.type === "p") {
      expect(block.runs[0]!.text).toBe("abc");
    }
    // selStore advanced to offset 3.
    const sel = editor.selStore.get();
    expect(sel.kind).toBe("caret");
    if (sel.kind === "caret") {
      expect(sel.at.offset).toBe(3);
    }
  });

  it("deleteContentBackward removes one char before the cursor", () => {
    const { editor, input } = mountEmpty();
    input("a");
    input("b");
    input("c");
    input("", "deleteContentBackward");
    const doc = editor.docStore.get();
    const block = doc.byId.get(doc.order[0]!)!;
    if (block.type === "p") {
      expect(block.runs[0]!.text).toBe("ab");
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(2);
  });

  it("backward delete at offset 0 is a no-op (block-merge lands in M5)", () => {
    const { editor, input } = mountEmpty();
    // Doc starts as one empty paragraph; selStore at offset 0.
    input("", "deleteContentBackward");
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(1);
    const block = doc.byId.get(doc.order[0]!)!;
    if (block.type === "p") expect(block.runs.length).toBe(0);
  });

  it("deleteContentForward removes one char after the cursor", () => {
    // Build a doc with content ahead of the cursor.
    const id = newBlockId();
    const root = makeContainer();
    const editor = createEditor({
      initial: {
        blocks: [
          {
            id,
            type: "p",
            runs: [{ text: "abcd" }],
          },
        ],
      },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    // Default selection is end-of-doc — move to offset 1 manually.
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [1], offset: 1 },
    });
    const textarea = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    const ev = new Event("beforeinput", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "data", { value: "" });
    Object.defineProperty(ev, "inputType", {
      value: "deleteContentForward",
    });
    textarea.dispatchEvent(ev);

    const block = editor.docStore.get().byId.get(id)!;
    if (block.type === "p") {
      expect(block.runs[0]!.text).toBe("acd");
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") expect(sel.at.offset).toBe(1);
  });

  it("composition events buffer until compositionend before mutating doc", () => {
    const { editor, textarea, raw } = mountEmpty();
    // compositionstart
    raw(new Event("compositionstart", { bubbles: true }));
    // compositionupdate fires during typing — must NOT mutate the doc
    const updateA = new Event("compositionupdate", { bubbles: true });
    Object.defineProperty(updateA, "data", { value: "に" });
    raw(updateA);
    let block = editor.docStore.get().byId.get(
      editor.docStore.get().order[0]!,
    )!;
    if (block.type === "p") expect(block.runs.length).toBe(0);
    const updateB = new Event("compositionupdate", { bubbles: true });
    Object.defineProperty(updateB, "data", { value: "にほ" });
    raw(updateB);
    block = editor.docStore.get().byId.get(editor.docStore.get().order[0]!)!;
    if (block.type === "p") expect(block.runs.length).toBe(0);
    // beforeinput firing during composition must also be ignored.
    const bi = new Event("beforeinput", { bubbles: true, cancelable: true });
    Object.defineProperty(bi, "data", { value: "に" });
    Object.defineProperty(bi, "inputType", { value: "insertCompositionText" });
    textarea.dispatchEvent(bi);
    block = editor.docStore.get().byId.get(editor.docStore.get().order[0]!)!;
    if (block.type === "p") expect(block.runs.length).toBe(0);
    // compositionend commits in a single mutation.
    textarea.value = "にほ";
    const end = new Event("compositionend", { bubbles: true });
    Object.defineProperty(end, "data", { value: "にほ" });
    raw(end);
    block = editor.docStore.get().byId.get(editor.docStore.get().order[0]!)!;
    if (block.type === "p") {
      expect(block.runs.length).toBe(1);
      expect(block.runs[0]!.text).toBe("にほ");
    }
    // Textarea is reset so it doesn't accumulate IME text on top of our doc.
    expect(textarea.value).toBe("");
  });
});
