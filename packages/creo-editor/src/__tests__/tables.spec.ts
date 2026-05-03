import { afterEach, describe, expect, it } from "bun:test";
import "./setup";
import { clearDom, makeContainer, SYNC_SCHEDULER } from "./setup";
import { createApp, HtmlRender } from "creo";

import { createEditor } from "../createEditor";
import { newBlockId } from "../model/doc";

afterEach(() => {
  clearDom();
});

function mountTable(rows = 2, cols = 3) {
  const root = makeContainer();
  const id = newBlockId();
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push([]);
    cells.push(row);
  }
  const editor = createEditor({
    initial: {
      blocks: [{ id, type: "table", rows, cols, cells }],
    },
  });
  createApp(
    () => editor.EditorView(),
    new HtmlRender(root),
    SYNC_SCHEDULER,
  ).mount();
  const ta = root.querySelector(
    "textarea[data-creo-input]",
  ) as HTMLTextAreaElement;
  return { root, editor, id, ta };
}

describe("Table rendering", () => {
  it("renders a <table><tbody> with the right number of <tr>/<td>", () => {
    const { root } = mountTable(3, 2);
    const tbl = root.querySelector("table.ce-table")!;
    expect(tbl).toBeTruthy();
    expect(tbl.querySelectorAll("tr").length).toBe(3);
    expect(tbl.querySelectorAll("td").length).toBe(6);
  });

  it("each cell carries data-block-id + data-cell for caret math", () => {
    const { root, id } = mountTable(2, 2);
    const cells = root.querySelectorAll(`td.ce-cell[data-block-id="${id}"]`);
    expect(cells.length).toBe(4);
    const positions = Array.from(cells).map((c) => c.getAttribute("data-cell"));
    expect(positions).toEqual(["0:0", "0:1", "1:0", "1:1"]);
  });
});

describe("Table editing", () => {
  it("typing inserts text into the current cell", () => {
    const { editor, id } = mountTable(2, 2);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [0, 1, 0], offset: 0 },
    });
    editor.dispatch({ t: "insertText", text: "hi" });
    const block = editor.docStore.get().byId.get(id)!;
    if (block.type === "table") {
      expect(block.cells[0]?.[1]?.[0]?.text).toBe("hi");
      // Other cells untouched.
      expect(block.cells[0]?.[0]?.length).toBe(0);
      expect(block.cells[1]?.[0]?.length).toBe(0);
    }
  });

  it("Tab navigates to next cell", () => {
    const { editor, id, ta } = mountTable(2, 2);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [0, 0, 0], offset: 0 },
    });
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    let sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.path[0]).toBe(0);
      expect(sel.at.path[1]).toBe(1);
    }
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.path[0]).toBe(1);
      expect(sel.at.path[1]).toBe(0);
    }
  });

  it("Tab past the last cell auto-adds a row", () => {
    const { editor, id, ta } = mountTable(2, 2);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [1, 1, 0], offset: 0 },
    });
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    const block = editor.docStore.get().byId.get(id)!;
    if (block.type === "table") {
      expect(block.rows).toBe(3);
    }
    const sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.path[0]).toBe(2);
      expect(sel.at.path[1]).toBe(0);
    }
  });

  it("Shift+Tab navigates backward", () => {
    const { editor, id, ta } = mountTable(2, 2);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [1, 0, 0], offset: 0 },
    });
    ta.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      }),
    );
    const sel = editor.selStore.get();
    if (sel.kind === "caret") {
      expect(sel.at.path[0]).toBe(0);
      expect(sel.at.path[1]).toBe(1);
    }
  });

  it("tableInsertRow / tableInsertCol grow the table", () => {
    const { editor, id } = mountTable(2, 2);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [0, 0, 0], offset: 0 },
    });
    editor.dispatch({ t: "tableInsertRow", where: "below" });
    let b = editor.docStore.get().byId.get(id)!;
    if (b.type === "table") {
      expect(b.rows).toBe(3);
      expect(b.cells.length).toBe(3);
    }
    editor.dispatch({ t: "tableInsertCol", where: "after" });
    b = editor.docStore.get().byId.get(id)!;
    if (b.type === "table") {
      expect(b.cols).toBe(3);
      expect(b.cells.every((row) => row.length === 3)).toBe(true);
    }
  });

  it("tableRemoveRow / tableRemoveCol shrink the table", () => {
    const { editor, id } = mountTable(3, 3);
    editor.selStore.set({
      kind: "caret",
      at: { blockId: id, path: [1, 1, 0], offset: 0 },
    });
    editor.dispatch({ t: "tableRemoveRow" });
    editor.dispatch({ t: "tableRemoveCol" });
    const b = editor.docStore.get().byId.get(id)!;
    if (b.type === "table") {
      expect(b.rows).toBe(2);
      expect(b.cols).toBe(2);
    }
  });

  it("insertTable command lands at caret", () => {
    const root = makeContainer();
    const editor = createEditor();
    createApp(
      () => editor.EditorView(),
      new HtmlRender(root),
      SYNC_SCHEDULER,
    ).mount();
    editor.dispatch({ t: "insertTable", rows: 2, cols: 2 });
    const order = editor.docStore.get().order;
    let foundTable = false;
    for (const id of order) {
      if (editor.docStore.get().byId.get(id)!.type === "table") foundTable = true;
    }
    expect(foundTable).toBe(true);
    expect(root.querySelector("table.ce-table")).toBeTruthy();
  });
});
