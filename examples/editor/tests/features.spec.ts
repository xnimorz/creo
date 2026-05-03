import { expect, test, type Page } from "@playwright/test";
import { EditorHarness } from "./helpers";

/**
 * Coverage for the six follow-up features:
 *  1. Mouse support — drag-select, double-click word, triple-click block
 *  2. Cmd/Ctrl + Arrow — word, line edge, doc edge
 *  3. Visual-line ArrowUp/Down respects column geometry
 *  4. Mode option — regular vs mono
 *  5. Arrows inside tables (left/right within cells, up/down across rows)
 *  6. Multi-column block — render + edit + Tab navigation
 */

async function buildDoc(page: Page, blocks: unknown[]) {
  await page.evaluate((blocks) => {
    const e = (window as { __editor?: { docStore: { set(d: unknown): void }; selStore: { set(s: unknown): void } } }).__editor!;
    const order: string[] = [];
    const byId = new Map<string, unknown>();
    blocks.forEach((b, i) => {
      const id = `tb${i}`;
      const idx = String.fromCharCode(65 + i);
      const block = { ...(b as { type: string }), id, index: idx };
      byId.set(id, block);
      order.push(id);
    });
    e.docStore.set({ byId, order });
    e.selStore.set({ kind: "caret", at: { blockId: order[0]!, path: [0], offset: 0 } });
  }, blocks);
}

// ---------------------------------------------------------------------------
// 1. Mouse support
// ---------------------------------------------------------------------------

test.describe("Mouse — drag select + double/triple click", () => {
  test("dragging the mouse extends the selection", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [{ type: "p", runs: [{ text: "hello world" }] }]);
    // Find the rendered span — drag from position of "h" to position of "d".
    const span = h.editor.locator("p span[data-run-index]");
    const box = await span.boundingBox();
    expect(box).not.toBeNull();
    // Press near the start, drag to near the end.
    const startX = box!.x + 4;
    const endX = box!.x + box!.width - 4;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 8 });
    await page.mouse.up();
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    expect((sel as { kind: string }).kind).toBe("range");
  });

  test("double-click selects the word under the pointer", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [{ type: "p", runs: [{ text: "hello world" }] }]);
    const span = h.editor.locator("p span[data-run-index]");
    const box = await span.boundingBox();
    expect(box).not.toBeNull();
    // Click somewhere inside "world" (right half of the span).
    await page.mouse.dblclick(box!.x + box!.width * 0.75, box!.y + box!.height / 2);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    expect((sel as { kind: string }).kind).toBe("range");
    // The selected range should cover at least 4 chars (the word "world"
    // is 5; allow some hit-testing slack).
    const start = (sel as { anchor: { offset: number } }).anchor.offset;
    const end = (sel as { focus: { offset: number } }).focus.offset;
    expect(Math.abs(end - start)).toBeGreaterThanOrEqual(4);
  });

  test("triple-click selects the entire block", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [{ type: "p", runs: [{ text: "the quick brown fox" }] }]);
    const span = h.editor.locator("p span[data-run-index]");
    const box = await span.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    expect((sel as { kind: string }).kind).toBe("range");
    const start = (sel as { anchor: { offset: number } }).anchor.offset;
    const end = (sel as { focus: { offset: number } }).focus.offset;
    expect(start).toBe(0);
    expect(end).toBe("the quick brown fox".length);
  });
});

// ---------------------------------------------------------------------------
// 2. Cmd/Ctrl + Arrow chords
// ---------------------------------------------------------------------------

test.describe("Word + line + doc nav chords", () => {
  test("word-jump skips over a word in one keypress", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("hello world stuff");
    await h.page.keyboard.press("Home");
    // On macOS-emulating profile this is Alt+Right; on Win/Linux it's Ctrl+Right.
    if (h.isMacEmulated) {
      await page.keyboard.press("Alt+ArrowRight");
    } else {
      await page.keyboard.press("Control+ArrowRight");
    }
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    // After jumping one word from offset 0, we land at the END of "hello"
    // = offset 5.
    expect((sel as { at: { offset: number } }).at.offset).toBe(5);
  });

  test("line-edge chord (Cmd+Right on Mac) jumps to end of block", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("the whole line");
    await h.page.keyboard.press("Home");
    if (h.isMacEmulated) {
      await page.keyboard.press("Meta+ArrowRight");
    } else {
      await page.keyboard.press("End");
    }
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    expect((sel as { at: { offset: number } }).at.offset).toBe(
      "the whole line".length,
    );
  });

  test("doc-edge chord (Cmd+Down on Mac / Ctrl+End elsewhere)", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "first" }] },
      { type: "p", runs: [{ text: "second" }] },
      { type: "p", runs: [{ text: "third" }] },
    ]);
    await h.focusKeepingSelection();
    if (h.isMacEmulated) {
      await page.keyboard.press("Meta+ArrowDown");
    } else {
      await page.keyboard.press("Control+End");
    }
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    expect((sel as { at: { blockId: string; offset: number } }).at.blockId).toBe(
      "tb2",
    );
    expect((sel as { at: { offset: number } }).at.offset).toBe("third".length);
  });
});

// ---------------------------------------------------------------------------
// 3. Visual-line Up/Down
// ---------------------------------------------------------------------------

test.describe("Visual-line Up/Down", () => {
  test("ArrowDown across mixed-size blocks doesn't jump by character offset", async ({
    page,
  }) => {
    // h1 + paragraph: caret somewhere inside the h1, ArrowDown should land
    // at a position whose horizontal X is close to the source X — not the
    // same character offset (the heading is much larger).
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "h1", runs: [{ text: "Welcome to Creo" }] },
      { type: "p", runs: [{ text: "This is a normal paragraph below." }] },
    ]);
    // Place caret after "Welcome to" (offset 10 in the h1).
    await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!;
      e.selStore.set({ kind: "caret", at: { blockId: "tb0", path: [10], offset: 10 } });
    });
    await h.focusKeepingSelection();
    // Capture the caret's pixel X before pressing down.
    const xBefore = await page.evaluate(() => {
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      return c ? Number(c.style.left.replace("px", "")) : 0;
    });
    expect(xBefore).toBeGreaterThan(0);
    await page.keyboard.press("ArrowDown");
    // After the move, caret should be in the paragraph (tb1) at an offset
    // close to xBefore in pixel terms.
    const result = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      const sel = e.selStore.get() as { at: { blockId: string; offset: number } };
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      return {
        blockId: sel.at.blockId,
        offset: sel.at.offset,
        leftPx: c ? Number(c.style.left.replace("px", "")) : null,
      };
    });
    expect(result.blockId).toBe("tb1");
    // Visual-line nav target should NOT be a pure character-offset copy of
    // the source — the h1 font is larger, so the same pixel column maps to
    // MORE characters in the smaller paragraph font. Plain block-jump would
    // have produced offset 10; visual-line nav should overshoot.
    expect(result.offset).toBeGreaterThan(10);
    // The new caret X should be within ~30px of the goal column.
    expect(Math.abs((result.leftPx ?? 0) - xBefore)).toBeLessThan(40);
  });
});

// ---------------------------------------------------------------------------
// 4. Mode (regular / mono)
// ---------------------------------------------------------------------------

test.describe("Editor mode", () => {
  test("default editor is regular mode", async ({ page }) => {
    const h = await EditorHarness.open(page);
    const cls = await h.editor.evaluate((el) => el.className);
    expect(cls).toContain("creo-editor-regular");
    expect(cls).not.toContain("creo-editor-mono");
  });

  test("?mode=mono opens the editor in monospace mode", async ({ page }) => {
    await page.goto("/?mode=mono");
    const editor = page.locator(".creo-editor");
    await editor.waitFor();
    const cls = await editor.evaluate((el) => el.className);
    expect(cls).toContain("creo-editor-mono");
    const fontFamily = await editor.evaluate(
      (el) => window.getComputedStyle(el).fontFamily,
    );
    // Sanity: computed font stack mentions a monospace family.
    expect(/mono|menlo|consolas|sf mono/i.test(fontFamily)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Arrows in tables
// ---------------------------------------------------------------------------

test.describe("Tables — arrow navigation", () => {
  test("ArrowDown navigates from row 0 to row 1 in the same column", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      {
        type: "table",
        rows: 2,
        cols: 3,
        cells: [
          [[{ text: "a" }], [{ text: "b" }], [{ text: "c" }]],
          [[{ text: "d" }], [{ text: "e" }], [{ text: "f" }]],
        ],
      },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb0", path: [0, 1, 0], offset: 0 },
      });
    });
    await h.focusKeepingSelection();
    await page.keyboard.press("ArrowDown");
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    const at = (sel as { at: { path: number[] } }).at;
    expect(at.path[0]).toBe(1);
    expect(at.path[1]).toBe(1);
  });

  test("ArrowRight at end of a cell jumps into the next cell", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      {
        type: "table",
        rows: 1,
        cols: 2,
        cells: [[[{ text: "abc" }], [{ text: "xyz" }]]],
      },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb0", path: [0, 0, 3], offset: 3 },
      });
    });
    await h.focusKeepingSelection();
    await page.keyboard.press("ArrowRight");
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    const at = (sel as { at: { path: number[] } }).at;
    expect(at.path).toEqual([0, 1, 0]);
  });

  test("ArrowUp from row 0 exits the table", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "before" }] },
      {
        type: "table",
        rows: 1,
        cols: 2,
        cells: [[[{ text: "a" }], [{ text: "b" }]]],
      },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb1", path: [0, 0, 0], offset: 0 },
      });
    });
    await h.focusKeepingSelection();
    await page.keyboard.press("ArrowUp");
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    const at = (sel as { at: { blockId: string } }).at;
    expect(at.blockId).toBe("tb0");
  });
});

// ---------------------------------------------------------------------------
// 6. Multi-column block
// ---------------------------------------------------------------------------

test.describe("Multi-column block", () => {
  test("insertColumns command renders an N-column grid", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focusKeepingSelection();
    await h.dispatch({ t: "insertColumns", cols: 3 });
    const cols = h.editor.locator(".ce-columns .ce-col[data-col]");
    await expect(cols).toHaveCount(3);
  });

  test("typing in column 0 doesn't bleed into other columns", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "columns", cols: 2, cells: [[], []] },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb0", path: [0, 0], offset: 0 },
      });
    });
    await h.focusKeepingSelection();
    await h.type("LEFT");
    const json = (await page.evaluate(() =>
      (window as { __editor?: { toJSON(): unknown } } ).__editor!.toJSON(),
    )) as { blocks: { type: string; cells?: { text: string }[][] }[] };
    const block = json.blocks[0]!;
    expect(block.type).toBe("columns");
    expect(block.cells![0]![0]!.text).toBe("LEFT");
    expect(block.cells![1]!.length).toBe(0);
  });

  test("ArrowRight at end of col 0 jumps to col 1", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "columns", cols: 2, cells: [[{ text: "abc" }], [{ text: "xyz" }]] },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb0", path: [0, 3], offset: 3 },
      });
    });
    await h.focusKeepingSelection();
    await page.keyboard.press("ArrowRight");
    const sel = await page.evaluate(() =>
      (window as { __editor?: { selStore: { get(): unknown } } }).__editor!.selStore.get(),
    );
    const at = (sel as { at: { path: number[] } }).at;
    expect(at.path).toEqual([1, 0]);
  });
});

// ---------------------------------------------------------------------------
// Click past end of line — standard editor UX. caretFromPoint returns
// nothing when the pointer isn't over a text node, so without the
// fallback in pointToAnchor a click in the right margin of a line would
// silently do nothing.
// ---------------------------------------------------------------------------

test.describe("Click past end of line", () => {
  test("clicking far right of a heading places caret at end of heading", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "h2", runs: [{ text: "Try these" }] },
      { type: "p", runs: [{ text: "more stuff" }] },
    ]);
    const heading = h.editor.locator("h2[data-block-id]");
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    // Click 200px past the rendered end of the heading text but inside
    // the editor's horizontal extent.
    const editorBox = await h.editor.boundingBox();
    expect(editorBox).not.toBeNull();
    const x = Math.min(editorBox!.x + editorBox!.width - 4, box!.x + box!.width + 200);
    const y = box!.y + box!.height / 2;
    await page.mouse.click(x, y);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    const at = (sel as { at: { blockId: string; offset: number } }).at;
    expect(at.blockId).toBe("tb0");
    expect(at.offset).toBe("Try these".length);
  });

  test("clicking below all content lands caret at end of last block", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "h1", runs: [{ text: "Top" }] },
      { type: "p", runs: [{ text: "middle" }] },
      { type: "p", runs: [{ text: "tail content" }] },
    ]);
    const editorBox = await h.editor.boundingBox();
    expect(editorBox).not.toBeNull();
    // Click in the bottom padding zone (below the last block but inside
    // the editor's bounding box).
    const x = editorBox!.x + 60;
    const y = editorBox!.y + editorBox!.height - 8;
    await page.mouse.click(x, y);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    const at = (sel as { at: { blockId: string; offset: number } }).at;
    expect(at.blockId).toBe("tb2");
    expect(at.offset).toBe("tail content".length);
  });

  test("clicking far left of a paragraph lands caret at start of line", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "narrow line" }] },
    ]);
    const para = h.editor.locator("p[data-block-id]");
    const box = await para.boundingBox();
    expect(box).not.toBeNull();
    // Click way to the left of the paragraph but on its line.
    await page.mouse.click(Math.max(0, box!.x - 80), box!.y + box!.height / 2);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    const at = (sel as { at: { blockId: string; offset: number } }).at;
    expect(at.blockId).toBe("tb0");
    expect(at.offset).toBe(0);
  });

  test("clicking 2px above a row, far right, lands caret at end of that row", async ({
    page,
  }) => {
    // Regression: caretFromPoint can return offset 0 of a text node when
    // the click is outside the text's bounding box (browser snaps to the
    // closest character at line edges). Without rect validation, Pass 1
    // succeeded with the wrong answer, so a click "slightly above row N,
    // far to the right" landed at start-of-row-N instead of end-of-row-N.
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "first row" }] },
      { type: "h2", runs: [{ text: "second row title" }] },
      { type: "p", runs: [{ text: "third row" }] },
    ]);
    const editorBox = await h.editor.boundingBox();
    expect(editorBox).not.toBeNull();
    // Aim for the h2 row.
    const h2 = h.editor.locator("h2[data-block-id]");
    const box = await h2.boundingBox();
    expect(box).not.toBeNull();
    const x = editorBox!.x + editorBox!.width - 6;
    const y = box!.y - 2; // 2px above the heading's top.
    await page.mouse.click(x, y);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    const at = (sel as { at: { blockId: string; offset: number } }).at;
    expect(at.blockId).toBe("tb1");
    expect(at.offset).toBe("second row title".length);
  });

  test("clicking on the list bullet lands caret at start of li (not end)", async ({
    page,
  }) => {
    // Regression: caretFromPoint hits the <li> element (not a text node)
    // when the user clicks on the CSS `::marker` bullet. The previous
    // offsetWithinBlock walked all text and returned the FULL length,
    // planting the caret at end-of-line instead of start-of-line.
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "li", ordered: false, depth: 0, runs: [{ text: "bullet item" }] },
    ]);
    const li = h.editor.locator("li[data-block-id]");
    const box = await li.boundingBox();
    expect(box).not.toBeNull();
    // Click 12px to the left of the li's text — that's where the bullet
    // dot sits, inside the <ul>'s padding.
    await page.mouse.click(box!.x - 12, box!.y + box!.height / 2);
    const sel = await page.evaluate(() => {
      const e = (window as { __editor?: { selStore: { get(): unknown } } }).__editor!;
      return e.selStore.get();
    });
    const at = (sel as { at: { blockId: string; offset: number } }).at;
    expect(at.blockId).toBe("tb0");
    expect(at.offset).toBe(0);
  });
});

test.describe("Range replace on type", () => {
  test("typing a character with a cross-block range replaces the range", async ({
    page,
  }) => {
    // Regression: insertText returned false for cross-block ranges,
    // silently dropping keystrokes. Backspace worked because the input
    // pipeline chained through mergeBackward; insertText didn't.
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "one" }] },
      { type: "p", runs: [{ text: "two" }] },
      { type: "p", runs: [{ text: "three" }] },
    ]);
    // Range covering "ne" of first p, all of second p, and "th" of third p.
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } })
        .__editor!.selStore.set({
          kind: "range",
          anchor: { blockId: "tb0", path: [1], offset: 1 },
          focus: { blockId: "tb2", path: [2], offset: 2 },
        });
    });
    await h.focusKeepingSelection();
    await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea[data-creo-input]",
      ) as HTMLTextAreaElement;
      const ev = new Event("beforeinput", { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "data", { value: "X" });
      Object.defineProperty(ev, "inputType", { value: "insertText" });
      ta.dispatchEvent(ev);
    });
    const state = await page.evaluate(() => {
      const e = (window as { __editor?: { docStore: { get(): { order: string[]; byId: Map<string, { runs: { text: string }[] }> } }; selStore: { get(): unknown } } }).__editor!;
      const doc = e.docStore.get();
      return {
        order: doc.order,
        text: doc.order.map(id => doc.byId.get(id)!.runs.map(r => r.text).join("")),
        sel: e.selStore.get(),
      };
    });
    // The three blocks collapsed into one whose text is the head + X + tail.
    expect(state.order).toHaveLength(1);
    expect(state.text[0]).toBe("oXree");
    const at = (state.sel as { at: { offset: number } }).at;
    expect(at.offset).toBe(2);
  });
});

test.describe("Caret in nested cells (table / columns)", () => {
  test("caret renders in the actual table cell after typing into it", async ({
    page,
  }) => {
    // Regression: caretRectFor measured against the OUTER block element
    // (the <table>) at offset 0, so the visible caret stayed glued to
    // cell [0][0] no matter where the user actually typed. Drilled into
    // the matching <td data-cell="r:c"> instead.
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      {
        type: "table",
        rows: 2,
        cols: 3,
        cells: [
          [[], [], []],
          [[], [], []],
        ],
      },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } })
        .__editor!.selStore.set({
          kind: "caret",
          at: { blockId: "tb0", path: [0, 2, 0], offset: 0 },
        });
    });
    await h.focusKeepingSelection();
    await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea[data-creo-input]",
      ) as HTMLTextAreaElement;
      for (const c of "abc") {
        const ev = new Event("beforeinput", {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(ev, "data", { value: c });
        Object.defineProperty(ev, "inputType", { value: "insertText" });
        ta.dispatchEvent(ev);
      }
    });
    // Caret X must be inside cell [0][2]'s horizontal range.
    const result = await page.evaluate(() => {
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      const td = document.querySelector(
        'td[data-cell="0:2"]',
      ) as HTMLElement;
      const root = document.querySelector(
        "[data-creo-editor]",
      ) as HTMLElement;
      const caretAbs =
        (c ? parseFloat(c.style.left) : 0) +
        root.getBoundingClientRect().left;
      const tdR = td.getBoundingClientRect();
      return {
        caretAbs,
        cellLeft: tdR.left,
        cellRight: tdR.right,
        cellInside: caretAbs >= tdR.left && caretAbs <= tdR.right,
      };
    });
    expect(result.cellInside).toBe(true);
  });

  test("caret renders in the actual columns cell after typing into it", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "columns", cols: 3, cells: [[], [], []] },
    ]);
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } })
        .__editor!.selStore.set({
          kind: "caret",
          at: { blockId: "tb0", path: [2, 0], offset: 0 },
        });
    });
    await h.focusKeepingSelection();
    await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea[data-creo-input]",
      ) as HTMLTextAreaElement;
      const ev = new Event("beforeinput", { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "data", { value: "RIGHT" });
      Object.defineProperty(ev, "inputType", { value: "insertText" });
      ta.dispatchEvent(ev);
    });
    const result = await page.evaluate(() => {
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      const col = document.querySelector(
        '[data-col="2"]',
      ) as HTMLElement;
      const root = document.querySelector(
        "[data-creo-editor]",
      ) as HTMLElement;
      const caretAbs =
        (c ? parseFloat(c.style.left) : 0) +
        root.getBoundingClientRect().left;
      const r = col.getBoundingClientRect();
      return {
        caretInside: caretAbs >= r.left && caretAbs <= r.right,
      };
    });
    expect(result.caretInside).toBe(true);
  });
});

test.describe("Trailing whitespace", () => {
  test("typing space at end of line advances the visible caret", async ({
    page,
  }) => {
    // Regression: the default `white-space: normal` collapsed trailing
    // whitespace, so `Range.getBoundingClientRect()` returned the same
    // x-position regardless of how many spaces sat at end-of-line. The
    // model offset advanced; the visual caret didn't. Editor felt frozen
    // when the user pressed space at end of a row.
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "p", runs: [{ text: "hello" }] },
    ]);
    // Caret at end of "hello".
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } })
        .__editor!.selStore.set({
          kind: "caret",
          at: { blockId: "tb0", path: [5], offset: 5 },
        });
    });
    await h.focusKeepingSelection();
    const xBefore = await page.evaluate(() => {
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      return c ? parseFloat(c.style.left) : 0;
    });
    expect(xBefore).toBeGreaterThan(0);
    // Type three spaces via beforeinput (page.keyboard.type triggers the
    // same input pipeline path).
    await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea[data-creo-input]",
      ) as HTMLTextAreaElement;
      for (let i = 0; i < 3; i++) {
        const ev = new Event("beforeinput", { bubbles: true, cancelable: true });
        Object.defineProperty(ev, "data", { value: " " });
        Object.defineProperty(ev, "inputType", { value: "insertText" });
        ta.dispatchEvent(ev);
      }
    });
    const xAfter = await page.evaluate(() => {
      const c = document.querySelector(".creo-caret") as HTMLElement | null;
      return c ? parseFloat(c.style.left) : 0;
    });
    // Caret must have visibly advanced.
    expect(xAfter).toBeGreaterThan(xBefore + 4);
    // Model has all 8 chars.
    const len = await page.evaluate(() => {
      const e = (window as { __editor?: { docStore: { get(): { byId: Map<string, { runs: { text: string }[] }> } } } }).__editor!;
      const b = e.docStore.get().byId.get("tb0")!;
      return b.runs.reduce((n, r) => n + r.text.length, 0);
    });
    expect(len).toBe(8);
    // CSS sanity-check: editor descendants inherit pre-wrap.
    const ws = await h.editor.locator("p[data-block-id]").evaluate((el) =>
      getComputedStyle(el).whiteSpace,
    );
    expect(ws).toBe("pre-wrap");
  });
});

test.describe("Cursor styling", () => {
  test("editor root shows the I-beam (cursor: text)", async ({ page }) => {
    const h = await EditorHarness.open(page);
    const cur = await h.editor.evaluate((el) => getComputedStyle(el).cursor);
    expect(cur).toBe("text");
  });

  test("image blocks override to default cursor (not I-beam)", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "img", src: "https://example.com/x.png" },
    ]);
    const cur = await h.editor
      .locator("div.ce-img")
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(cur).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// Regression: pressing Enter twice between a heading and a list visually
// duplicated everything below the heading. Repro from a real session: caret
// at end of an h2, two splitBlock dispatches in a row. The doc model was
// always correct (two empty paragraphs inserted in the right place); the
// rendered DOM was wrong because the engine's reconcileKeyed Phase 3
// dropped the tail-synced views from view.children, so the new paragraphs
// got appended to the parent instead of inserted before the list.
// ---------------------------------------------------------------------------

test.describe("Regression: Enter-Enter at end of heading", () => {
  test("DOM order matches model after two splits", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await buildDoc(page, [
      { type: "h1", runs: [{ text: "Title" }] },
      { type: "p", runs: [{ text: "intro" }] },
      { type: "h2", runs: [{ text: "Try these" }] },
      { type: "li", ordered: false, depth: 0, runs: [{ text: "alpha" }] },
      { type: "li", ordered: false, depth: 0, runs: [{ text: "beta" }] },
      { type: "li", ordered: false, depth: 0, runs: [{ text: "gamma" }] },
      { type: "p", runs: [{ text: "tail" }] },
    ]);
    // Place caret at end of the h2 (block tb2, offset = "Try these".length).
    await page.evaluate(() => {
      (window as { __editor?: { selStore: { set(s: unknown): void } } }).__editor!.selStore.set({
        kind: "caret",
        at: { blockId: "tb2", path: [9], offset: 9 },
      });
    });
    await h.focusKeepingSelection();
    // Enter twice — same as user pressing Return twice.
    await h.dispatch({ t: "splitBlock" });
    await h.dispatch({ t: "splitBlock" });
    // Read the rendered block IDs in DOM order.
    const domOrder = await page.evaluate(() => {
      const editor = document.querySelector(".creo-editor")!;
      const out: string[] = [];
      const walk = (node: Element) => {
        const id = node.getAttribute("data-block-id");
        // Only record top-level block elements (skip overlays / textareas /
        // span run-children inside a block).
        if (id && /\bce-block\b/.test(node.className)) out.push(id);
        for (const child of Array.from(node.children)) walk(child);
      };
      walk(editor);
      return out;
    });
    // Read the model order for comparison.
    const modelOrder = await page.evaluate(() => {
      const e = (window as { __editor?: { docStore: { get(): { order: string[] } } } }).__editor!;
      return e.docStore.get().order;
    });
    // The two new paragraphs MUST be inserted between the h2 and the first
    // list item — same as the model.
    expect(domOrder).toEqual(modelOrder);
    // Sanity: the heading still occurs exactly once (no section duplicate).
    const headings = await page.locator(".creo-editor h2[data-block-id]").count();
    expect(headings).toBe(1);
  });
});
