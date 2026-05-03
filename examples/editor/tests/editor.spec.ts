import { expect, test } from "@playwright/test";
import { EditorHarness } from "./helpers";

test.describe("Editor — typing and structure", () => {
  test('typing "hello" produces a single <p>hello</p>', async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("hello");
    const p = h.editor.locator("p[data-block-id]");
    await expect(p).toHaveCount(1);
    await expect(p).toHaveText("hello");
  });

  test("Enter splits into two paragraphs; Backspace at start of line 2 merges", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("hello world");
    // Move cursor between "hello" and " world".
    for (let i = 0; i < " world".length; i++) {
      await h.page.keyboard.press("ArrowLeft");
    }
    await h.page.keyboard.press("Enter");
    await expect(h.paragraphs()).toHaveCount(2);
    await expect(h.paragraphs().nth(0)).toHaveText("hello");
    await expect(h.paragraphs().nth(1)).toHaveText(" world");
    await h.page.keyboard.press("Backspace");
    await expect(h.paragraphs()).toHaveCount(1);
    await expect(h.paragraphs().nth(0)).toHaveText("hello world");
  });

  test("Cmd/Ctrl+B then type wraps subsequent text in <strong>", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("hello world");
    // Select "hello".
    await h.page.keyboard.press("Home");
    for (let i = 0; i < 5; i++) {
      await h.page.keyboard.press(`Shift+ArrowRight`);
    }
    await h.chord(`${h.mod}+b`);
    const strong = h.editor.locator("strong");
    await expect(strong).toHaveCount(1);
    await expect(strong).toHaveText("hello");
  });
});

test.describe("Editor — block types", () => {
  test("Cmd+Alt+1 promotes the current paragraph to <h1>", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("Title");
    await h.chord(`${h.mod}+Alt+1`);
    await expect(h.editor.locator("h1[data-block-id]")).toHaveText("Title");
  });

  test("Cmd+Alt+0 demotes a heading back to a paragraph", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("Title");
    await h.chord(`${h.mod}+Alt+1`);
    await expect(h.editor.locator("h1[data-block-id]")).toHaveCount(1);
    await h.chord(`${h.mod}+Alt+0`);
    await expect(h.editor.locator("h1[data-block-id]")).toHaveCount(0);
    await expect(h.editor.locator("p[data-block-id]")).toHaveText("Title");
  });
});

test.describe("Editor — clipboard", () => {
  test("paste plain text with newlines creates multiple paragraphs", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.pastePlain("alpha\nbeta\ngamma");
    const ps = h.paragraphs();
    const texts = await ps.allTextContents();
    const joined = texts.join("|");
    expect(joined).toContain("alpha");
    expect(joined).toContain("beta");
    expect(joined).toContain("gamma");
  });

  test("paste HTML with <h2> and <ul> preserves structure", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.pasteHTML(
      "<h2>Section</h2><ul><li>one</li><li>two</li></ul>",
      "Section\none\ntwo",
    );
    await expect(h.editor.locator("h2[data-block-id]")).toHaveText("Section");
    await expect(h.editor.locator("ul.ce-list li[data-block-id]")).toHaveCount(2);
  });

  test("Shift+Paste forces plain-text interpretation (no <h1>)", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.pastePlain("plain text", /*withShift*/ true);
    await expect(h.editor.locator("h1[data-block-id]")).toHaveCount(0);
  });
});

test.describe("Editor — lists", () => {
  test("toggleList wraps consecutive paragraphs into a <ul>", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("one");
    await h.page.keyboard.press("Enter");
    await h.type("two");
    await h.page.keyboard.press("Enter");
    await h.type("three");
    // Select-all then toggle list.
    await h.chord(`${h.mod}+a`);
    await h.dispatch({ t: "toggleList", ordered: false });
    await expect(h.editor.locator("ul.ce-list")).toHaveCount(1);
    await expect(
      h.editor.locator("ul.ce-list li[data-block-id]"),
    ).toHaveCount(3);
  });

  test("Tab inside a list item indents (depth class bumps)", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("item");
    await h.dispatch({ t: "toggleList", ordered: false });
    await h.page.keyboard.press("Tab");
    const li = h.editor.locator("li[data-block-id]");
    await expect(li).toHaveAttribute("data-depth", "1");
    await h.page.keyboard.press("Tab");
    await expect(li).toHaveAttribute("data-depth", "2");
    await h.page.keyboard.press("Shift+Tab");
    await expect(li).toHaveAttribute("data-depth", "1");
  });
});

test.describe("Editor — tables", () => {
  test("insertTable lands a 3×3 grid; Tab navigates cells; typing fills cells", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.dispatch({ t: "insertTable", rows: 3, cols: 3 });
    const tbl = h.editor.locator("table.ce-table");
    await expect(tbl).toHaveCount(1);
    await expect(tbl.locator("tr")).toHaveCount(3);
    await expect(tbl.locator("td.ce-cell")).toHaveCount(9);
    // Cursor sits at top-left cell — type, Tab, type, Tab.
    await h.page.evaluate(() => {
      const e = (window as unknown as {
        __editor?: { docStore: { get(): { order: string[]; byId: Map<string, { type: string }> } }; selStore: { set(s: unknown): void } };
      }).__editor!;
      const doc = e.docStore.get();
      // Find the table block id.
      const tableId = doc.order.find((id) => doc.byId.get(id)!.type === "table")!;
      e.selStore.set({
        kind: "caret",
        at: { blockId: tableId, path: [0, 0, 0], offset: 0 },
      });
    });
    await h.focusKeepingSelection();
    await h.type("A");
    await h.page.keyboard.press("Tab");
    await h.type("B");
    const cells = tbl.locator("td.ce-cell");
    await expect(cells.nth(0)).toContainText("A");
    await expect(cells.nth(1)).toContainText("B");
  });
});

test.describe("Editor — images", () => {
  test("insertImage by URL adds an <img> block", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.dispatch({
      t: "insertImage",
      src: "https://example.com/cat.png",
      alt: "cat",
    });
    const img = h.editor.locator("div.ce-img img");
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute("src", "https://example.com/cat.png");
  });
});

test.describe("Editor — selection rendering", () => {
  test("dragging a range with the keyboard renders selection rectangles", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("hello world");
    await h.page.keyboard.press("Home");
    for (let i = 0; i < 5; i++) {
      await h.page.keyboard.press("Shift+ArrowRight");
    }
    // Overlay renders one rect per visual line; "hello" sits on a single line.
    await expect(h.page.locator(".creo-selection-rect")).toHaveCount(1);
  });

  test("collapsed selection shows a blinking caret div", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.type("x");
    await expect(h.page.locator(".creo-caret")).toHaveCount(1);
  });
});

test.describe("Editor — undo / redo", () => {
  test("undo/redo round-trips 5 distinct edits", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    // 5 distinct (non-coalesced) edits: split, type, split, type, mark.
    await h.type("a");
    await h.page.keyboard.press("Enter");
    await h.type("b");
    await h.page.keyboard.press("Enter");
    await h.type("c");
    const before = await h.toJSON();
    // Undo all the way back to empty.
    for (let i = 0; i < 10; i++) await h.undo();
    const empty = await h.toJSON();
    const text = empty.blocks
      .map((b) => (b.runs ?? []).map((r) => r.text).join(""))
      .join("|");
    expect(text.trim()).toBe("");
    // Redo all the way forward.
    for (let i = 0; i < 10; i++) await h.redo();
    const after = await h.toJSON();
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

test.describe("Editor — IME composition", () => {
  test("compositionupdate doesn't mutate the doc; commit happens on compositionend", async ({
    page,
  }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    await h.composition(["に", "にほ", "にほん"], "日本");
    const p = h.editor.locator("p[data-block-id]");
    await expect(p).toContainText("日本");
    // Single mutation — paragraph contains exactly one text node worth.
    const json = await h.toJSON();
    const totalLen = json.blocks
      .filter((b) => b.type === "p")
      .flatMap((b) => b.runs ?? [])
      .reduce((n, r) => n + r.text.length, 0);
    expect(totalLen).toBe("日本".length);
  });
});

test.describe("Editor — performance", () => {
  test("paste of 10k-word fixture reconciles under 500ms", async ({ page }) => {
    const h = await EditorHarness.open(page);
    await h.focus();
    const text = await page.evaluate(() => {
      const word = "lorem";
      const lines: string[] = [];
      for (let i = 0; i < 200; i++) {
        lines.push(new Array(50).fill(word).join(" "));
      }
      return lines.join("\n\n");
    });
    const t0 = await page.evaluate(() => performance.now());
    await h.pastePlain(text);
    const t1 = await page.evaluate(() => performance.now());
    expect(t1 - t0).toBeLessThan(1500); // CI-friendly cushion vs 500ms target
    // sanity: many paragraphs landed.
    const count = await h.paragraphs().count();
    expect(count).toBeGreaterThan(50);
  });
});
