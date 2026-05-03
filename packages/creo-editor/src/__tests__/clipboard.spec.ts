import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { caretAt } from "../controller/selection";
import { newBlockId } from "../model/doc";
import { parseHTML, parsePlainText } from "../clipboard/htmlParser";
import { docToHtml, selectionToClipboard } from "../clipboard/htmlSerializer";

afterEach(() => {
  clearDom();
});

function pasteEvent(html: string, plain: string): Event {
  const dt = new DataTransfer();
  if (html) dt.setData("text/html", html);
  if (plain) dt.setData("text/plain", plain);
  const ev = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", {
    value: dt,
    configurable: true,
  });
  return ev;
}

describe("HTML parser", () => {
  it("parses paragraphs and headings", () => {
    const blocks = parseHTML("<h1>Title</h1><p>Hello <b>world</b></p>");
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.type).toBe("h1");
    expect(blocks[1]!.type).toBe("p");
    if (blocks[1]!.type === "p") {
      const runs = blocks[1]!.runs;
      expect(runs.length).toBe(2);
      expect(runs[0]!.text).toBe("Hello ");
      expect(runs[1]!.text).toBe("world");
      expect(runs[1]!.marks?.has("b")).toBe(true);
    }
  });

  it("parses unordered + ordered lists", () => {
    const blocks = parseHTML(
      "<ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>",
    );
    expect(blocks.length).toBe(3);
    expect(blocks[0]!.type).toBe("li");
    if (blocks[0]!.type === "li") expect(blocks[0]!.ordered).toBe(false);
    if (blocks[2]!.type === "li") expect(blocks[2]!.ordered).toBe(true);
  });

  it("strips <script>, on* attrs, and javascript: URLs", () => {
    const blocks = parseHTML(
      `<p onclick="x">x</p><script>alert(1)</script><a href="javascript:bad()">y</a>`,
    );
    // Two paragraphs survive ("x" and "y"); script is gone.
    let total = "";
    for (const b of blocks) {
      if (b.type === "p") for (const r of b.runs) total += r.text;
    }
    expect(total).toBe("xy");
  });

  it("flattens unknown block tags into paragraphs", () => {
    const blocks = parseHTML("<custom-thing>plain text</custom-thing>");
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("p");
  });

  it("recurses into nested block containers (div > p > strong)", () => {
    const blocks = parseHTML(
      "<div><p>hello <strong>bold</strong> end</p></div>",
    );
    expect(blocks.length).toBe(1);
    if (blocks[0]!.type === "p") {
      const txt = blocks[0]!.runs.map((r) => r.text).join("");
      expect(txt).toBe("hello bold end");
    }
  });

  it("plain-text paragraphs split on blank-line separators", () => {
    const blocks = parsePlainText("one\ntwo\n\nthree");
    expect(blocks.length).toBe(3);
    if (blocks[2]!.type === "p") expect(blocks[2]!.runs[0]!.text).toBe("three");
  });
});

describe("HTML serializer", () => {
  it("docToHtml round-trips simple structure", () => {
    const root = makeContainer();
    const editor = createEditor({
      initial: {
        blocks: [
          { type: "h2", runs: [{ text: "T" }] },
          { type: "p", runs: [{ text: "P" }] },
        ],
      },
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    const html = docToHtml(editor.docStore.get());
    expect(html).toContain("<h2>T</h2>");
    expect(html).toContain("<p>P</p>");
  });

  it("selectionToClipboard returns html + plain for a single-block range", () => {
    const id = newBlockId();
    const editor = createEditor({
      initial: {
        blocks: [{ id, type: "p", runs: [{ text: "hello world" }] }],
      },
    });
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 0),
      focus: caretAt(id, 5),
    });
    const out = selectionToClipboard(
      editor.docStore.get(),
      editor.selStore.get(),
    );
    expect(out.plain).toBe("hello");
    expect(out.html).toContain("hello");
  });
});

describe("Paste integration", () => {
  it("paste HTML inserts blocks at caret", () => {
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
    ta.dispatchEvent(
      pasteEvent("<p>hello</p><p>world</p>", "hello\nworld"),
    );
    const doc = editor.docStore.get();
    // Initial empty paragraph + the two inserted ones, possibly merged.
    // Our splitAndInsert path replaces the empty paragraph's left runs with
    // the first pasted block's runs, then appends the second as a new block.
    let totalText = "";
    for (const id of doc.order) {
      const b = doc.byId.get(id)!;
      if (b.type === "p") for (const r of b.runs) totalText += r.text;
    }
    expect(totalText).toContain("hello");
    expect(totalText).toContain("world");
  });

  it("Shift+Paste forces plain-text interpretation", () => {
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
    // Hold shift before paste — clipboard handler watches keydown.
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        bubbles: true,
        shiftKey: true,
      }),
    );
    ta.dispatchEvent(
      pasteEvent("<h1>BIG</h1>", "BIG"),
    );
    const doc = editor.docStore.get();
    // No <h1> — plain-text fallback inserts as paragraph.
    for (const id of doc.order) {
      expect(doc.byId.get(id)!.type === "h1").toBe(false);
    }
  });

  it("paste plain-text with newlines creates multiple paragraphs", () => {
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
    ta.dispatchEvent(
      pasteEvent("", "alpha\nbeta\ngamma"),
    );
    const doc = editor.docStore.get();
    // Ensure each paragraph appears.
    let texts: string[] = [];
    for (const id of doc.order) {
      const b = doc.byId.get(id)!;
      if (b.type === "p") {
        let t = "";
        for (const r of b.runs) t += r.text;
        texts.push(t);
      }
    }
    expect(texts.join("|")).toContain("alpha");
    expect(texts.join("|")).toContain("beta");
    expect(texts.join("|")).toContain("gamma");
  });

  it("setDocFromHTML replaces the doc wholesale", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    editor.setDocFromHTML("<h2>Title</h2><p>Body text</p>");
    const doc = editor.docStore.get();
    expect(doc.order.length).toBe(2);
    expect(doc.byId.get(doc.order[0]!)!.type).toBe("h2");
    expect(doc.byId.get(doc.order[1]!)!.type).toBe("p");
  });

  it("copy on a range sets text/html and text/plain on clipboardData", () => {
    const root = makeContainer();
    const id = newBlockId();
    const editor = createEditor({
      initial: { blocks: [{ id, type: "p", runs: [{ text: "abcdef" }] }] },
    });
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    editor.selStore.set({
      kind: "range",
      anchor: caretAt(id, 1),
      focus: caretAt(id, 4),
    });
    const ta = root.querySelector(
      "textarea[data-creo-input]",
    ) as HTMLTextAreaElement;
    const dt = new DataTransfer();
    const ev = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: dt });
    ta.dispatchEvent(ev);
    expect(dt.getData("text/plain")).toBe("bcd");
    expect(dt.getData("text/html")).toContain("bcd");
  });
});
