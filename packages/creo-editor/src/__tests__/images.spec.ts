import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";

afterEach(() => {
  clearDom();
});

// happy-dom polyfill — URL.createObjectURL may not exist.
function ensureObjectURL() {
  const u = (globalThis as { URL?: { createObjectURL?: unknown } }).URL;
  if (u && typeof u.createObjectURL !== "function") {
    (u as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
      (b: Blob) => `blob:dummy/${b.size}`;
  }
}

describe("Image rendering", () => {
  it("renders <img> for an image block", () => {
    const root = makeContainer();
    const id = newBlockId();
    const editor = createEditor({
      initial: {
        blocks: [
          {
            id,
            type: "img",
            src: "https://example.com/x.png",
            alt: "alt",
            width: 100,
            height: 50,
          },
        ],
      },
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    const wrapper = root.querySelector(`[data-block-id="${id}"].ce-img`);
    expect(wrapper).toBeTruthy();
    const img = wrapper!.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("src")).toBe("https://example.com/x.png");
    expect(img!.getAttribute("alt")).toBe("alt");
  });
});

describe("Image insertion + deletion", () => {
  it("insertImage command adds an image block at the caret", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    editor.dispatch({
      t: "insertImage",
      src: "https://example.com/cat.png",
      alt: "cat",
    });
    const order = editor.docStore.get().order;
    let foundImg = false;
    for (const id of order) {
      if (editor.docStore.get().byId.get(id)!.type === "img") foundImg = true;
    }
    expect(foundImg).toBe(true);
    expect(root.querySelector("img")).toBeTruthy();
  });

  it("Backspace on an image block removes it", () => {
    const root = makeContainer();
    const id = newBlockId();
    const editor = createEditor({
      initial: {
        blocks: [{ id, type: "img", src: "https://example.com/x.png" }],
      },
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    editor.selStore.set({ kind: "caret", at: { blockId: id, path: [0], offset: 0 } });
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
    expect(editor.docStore.get().byId.has(id)).toBe(false);
  });

  it("paste of an image File becomes an image block", async () => {
    ensureObjectURL();
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;

    const blob = new Blob(["fake-bytes"], { type: "image/png" });
    const file = new File([blob], "pic.png", { type: "image/png" });
    const dt = new DataTransfer();
    // happy-dom DataTransfer doesn't always allow .items.add; fall back to
    // overriding files directly.
    Object.defineProperty(dt, "files", {
      value: { length: 1, 0: file, [Symbol.iterator]: function* () { yield file; } },
      configurable: true,
    });

    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: dt, configurable: true });
    ta.dispatchEvent(ev);

    // image insertion is async because the upload hook may be async; let
    // the microtask + promise chain settle.
    await new Promise((r) => setTimeout(r, 10));

    const doc = editor.docStore.get();
    let found = false;
    for (const id of doc.order) {
      if (doc.byId.get(id)!.type === "img") found = true;
    }
    expect(found).toBe(true);
  });

  it("uploadImage hook is awaited and its returned URL becomes src", async () => {
    const editor = createEditor({
      uploadImage: async (f) => `cdn://upload/${f.name}`,
    });
    const root = makeContainer();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    const blob = new Blob(["xyz"], { type: "image/jpeg" });
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    const dt = new DataTransfer();
    Object.defineProperty(dt, "files", {
      value: { length: 1, 0: file, [Symbol.iterator]: function* () { yield file; } },
      configurable: true,
    });
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: dt, configurable: true });
    ta.dispatchEvent(ev);
    await new Promise((r) => setTimeout(r, 10));
    const doc = editor.docStore.get();
    let img = null;
    for (const id of doc.order) {
      const b = doc.byId.get(id)!;
      if (b.type === "img") img = b;
    }
    expect(img?.src).toBe("cdn://upload/photo.jpg");
  });
});
