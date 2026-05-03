import type { Store } from "creo";
import { getBlock, updateBlock } from "../model/doc";
import {
  anchorOffset,
  caret,
} from "../controller/selection";
import type {
  Block,
  DocState,
  InlineRun,
  Selection,
  TableBlock,
} from "../model/types";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

function currentTable(
  doc: DocState,
  sel: Selection,
): { block: TableBlock; row: number; col: number; off: number } | null {
  const start = sel.kind === "caret" ? sel.at : sel.anchor;
  const block = getBlock(doc, start.blockId);
  if (!block || block.type !== "table") return null;
  return {
    block: block as TableBlock,
    row: start.path[0] ?? 0,
    col: start.path[1] ?? 0,
    off: anchorOffset(start),
  };
}

function emptyRow(cols: number): InlineRun[][] {
  const row: InlineRun[][] = [];
  for (let i = 0; i < cols; i++) row.push([]);
  return row;
}

// ---------------------------------------------------------------------------
// Tab navigation — move to next/previous cell, wrapping rows.
// ---------------------------------------------------------------------------

export function tableNextCell(stores: Stores): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, row, col } = ctx;
  let nr = row;
  let nc = col + 1;
  if (nc >= block.cols) {
    nc = 0;
    nr += 1;
  }
  if (nr >= block.rows) {
    // Auto-add a new row when tabbing past the last cell — mirrors Word /
    // Google Docs UX.
    return tableInsertRow(stores, "below", /*moveTo*/ true);
  }
  stores.selStore.set(
    caret({ blockId: block.id, path: [nr, nc, 0], offset: 0 }),
  );
  return true;
}

export function tablePrevCell(stores: Stores): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, row, col } = ctx;
  let nr = row;
  let nc = col - 1;
  if (nc < 0) {
    nc = block.cols - 1;
    nr -= 1;
  }
  if (nr < 0) return false;
  stores.selStore.set(
    caret({ blockId: block.id, path: [nr, nc, 0], offset: 0 }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Add / remove rows + columns
// ---------------------------------------------------------------------------

export function tableInsertRow(
  stores: Stores,
  where: "above" | "below",
  moveTo = false,
): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, row } = ctx;
  const insertAt = where === "above" ? row : row + 1;
  const cells = [
    ...block.cells.slice(0, insertAt),
    emptyRow(block.cols),
    ...block.cells.slice(insertAt),
  ];
  const next: TableBlock = {
    ...block,
    rows: block.rows + 1,
    cells,
  };
  stores.docStore.set(updateBlock(stores.docStore.get(), next as Block));
  if (moveTo) {
    stores.selStore.set(
      caret({ blockId: block.id, path: [insertAt, 0, 0], offset: 0 }),
    );
  }
  return true;
}

export function tableInsertCol(
  stores: Stores,
  where: "before" | "after",
): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, col } = ctx;
  const insertAt = where === "before" ? col : col + 1;
  const cells = block.cells.map((row) => [
    ...row.slice(0, insertAt),
    [] as InlineRun[],
    ...row.slice(insertAt),
  ]);
  const next: TableBlock = {
    ...block,
    cols: block.cols + 1,
    cells,
  };
  stores.docStore.set(updateBlock(stores.docStore.get(), next as Block));
  return true;
}

export function tableRemoveRow(stores: Stores): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, row } = ctx;
  if (block.rows <= 1) return false;
  const cells = block.cells.filter((_, i) => i !== row);
  const next: TableBlock = {
    ...block,
    rows: block.rows - 1,
    cells,
  };
  stores.docStore.set(updateBlock(stores.docStore.get(), next as Block));
  // Move caret to the same row index (clamped) of the same column.
  const newRow = Math.min(row, next.rows - 1);
  stores.selStore.set(
    caret({ blockId: block.id, path: [newRow, ctx.col, 0], offset: 0 }),
  );
  return true;
}

export function tableRemoveCol(stores: Stores): boolean {
  const ctx = currentTable(stores.docStore.get(), stores.selStore.get());
  if (!ctx) return false;
  const { block, col } = ctx;
  if (block.cols <= 1) return false;
  const cells = block.cells.map((row) => row.filter((_, i) => i !== col));
  const next: TableBlock = {
    ...block,
    cols: block.cols - 1,
    cells,
  };
  stores.docStore.set(updateBlock(stores.docStore.get(), next as Block));
  const newCol = Math.min(col, next.cols - 1);
  stores.selStore.set(
    caret({ blockId: block.id, path: [ctx.row, newCol, 0], offset: 0 }),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Selection helpers — useful for the Tab / Shift-Tab keymap to detect when
// the caret is inside a table.
// ---------------------------------------------------------------------------

export function isInTable(doc: DocState, sel: Selection): boolean {
  return currentTable(doc, sel) !== null;
}
