import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { newBlockId, updateBlock } from "../model/doc";
import type { BlockSpec, ParagraphBlock } from "../model/types";

beforeAll(() => {
  // setup.ts already wired globals.
});

afterEach(() => {
  clearDom();
});

function makeDocOf(n: number): { ids: string[]; blocks: BlockSpec[] } {
  const ids: string[] = [];
  const blocks: BlockSpec[] = [];
  for (let i = 0; i < n; i++) {
    const id = newBlockId();
    ids.push(id);
    const b: Omit<ParagraphBlock, "index"> = {
      id,
      type: "p",
      runs: [{ text: `paragraph ${i}` }],
    };
    blocks.push(b);
  }
  return { ids, blocks };
}

function findParagraphs(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (n: Node) => {
    if (
      n instanceof HTMLElement &&
      n.tagName.toLowerCase() === "p" &&
      n.getAttribute("data-block-id")
    ) {
      out.push(n);
    }
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(root);
  return out;
}

describe("createEditor — minimal render", () => {
  it("renders a 5-paragraph doc into a single editor root", () => {
    const root = makeContainer();
    const { blocks } = makeDocOf(5);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
    });

    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();

    const editorRoot = root.querySelector("[data-creo-editor]") as HTMLElement;
    expect(editorRoot).toBeTruthy();
    const ps = findParagraphs(editorRoot);
    expect(ps.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(ps[i]!.textContent).toBe(`paragraph ${i}`);
    }
  });

  it("preserves DOM identity for untouched blocks when one mutates", () => {
    const root = makeContainer();
    const { ids, blocks } = makeDocOf(5);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
    });

    const handle = createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
    ).mount();

    const before = findParagraphs(root);
    expect(before.length).toBe(5);

    // Mutate the third block — replace runs.
    const doc = editor.docStore.get();
    const target = doc.byId.get(ids[2]!) as ParagraphBlock;
    const newDoc = updateBlock(doc, {
      ...target,
      runs: [{ text: "MUTATED" }],
    });
    editor.docStore.set(newDoc);
    handle.engine.render();

    const after = findParagraphs(root);
    expect(after.length).toBe(5);

    // Block ordering preserved.
    for (let i = 0; i < 5; i++) {
      expect(after[i]!.getAttribute("data-block-id")).toBe(ids[i]!);
    }
    // Untouched blocks: same DOM node identity.
    for (let i = 0; i < 5; i++) {
      if (i === 2) continue;
      expect(after[i]!).toBe(before[i]!);
    }
    // Mutated block reflects new text.
    expect(after[2]!.textContent).toBe("MUTATED");
  });

  it("toJSON round-trips initial content", () => {
    const root = makeContainer();
    const { blocks } = makeDocOf(3);
    const editor = createEditor({
      initial: { blocks: blocks.map((b) => ({ ...b } as never)) },
    });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();

    const json = editor.toJSON();
    expect(json.blocks.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      const b = json.blocks[i]!;
      expect(b.type).toBe("p");
      if (b.type === "p") {
        expect(b.runs.length).toBe(1);
        expect(b.runs[0]!.text).toBe(`paragraph ${i}`);
      }
    }
  });

  it("applies mark wrappers in deterministic order", () => {
    const root = makeContainer();
    const id = newBlockId();
    const initial = {
      blocks: [
        {
          id,
          type: "p" as const,
          runs: [{ text: "hi", marks: ["b", "i"] }],
        },
      ],
    };
    const editor = createEditor({ initial });
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();

    const para = root.querySelector(`[data-block-id="${id}"]`) as HTMLElement;
    // MARK_ORDER iterates code→b→i→u→s; each mark wraps OUTSIDE the previous,
    // so for marks=[b,i] the DOM is em > strong > span.
    const em = para.querySelector("em");
    expect(em).toBeTruthy();
    const strong = em!.querySelector("strong");
    expect(strong).toBeTruthy();
    const span = strong!.querySelector("span[data-run-index]");
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe("hi");
  });

  it("creates a default empty paragraph when initial is omitted", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(() => editor.EditorView(), new HtmlRender(root)).mount();
    const ps = findParagraphs(root);
    expect(ps.length).toBe(1);
    // Empty paragraph has a zero-width-space placeholder so it has measurable
    // line-box height.
    expect(ps[0]!.textContent).toBe("​");
  });
});
