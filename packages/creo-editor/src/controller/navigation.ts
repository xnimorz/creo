import {
  blockTextLength,
  isTextBearing,
  type TextBearingBlock,
} from "../model/blockText";
import { findPos, getBlock } from "../model/doc";
import type {
  Anchor,
  ColumnsBlock,
  DocState,
  InlineRun,
  TableBlock,
} from "../model/types";
import { anchorOffset, caretAt, withCharOffset } from "./selection";
import { nextWordOffset, prevWordOffset } from "./wordBoundary";

// ---------------------------------------------------------------------------
// Block-edge anchors
// ---------------------------------------------------------------------------

function startAnchorOfBlock(doc: DocState, blockId: string): Anchor | null {
  const b = getBlock(doc, blockId);
  if (!b) return null;
  if (isTextBearing(b)) return caretAt(blockId, 0);
  if (b.type === "img") return { blockId, path: [0], offset: 0 };
  if (b.type === "columns") return { blockId, path: [0, 0], offset: 0 };
  // table — top-left cell, offset 0
  return { blockId, path: [0, 0, 0], offset: 0 };
}

function endAnchorOfBlock(doc: DocState, blockId: string): Anchor | null {
  const b = getBlock(doc, blockId);
  if (!b) return null;
  if (isTextBearing(b)) {
    return caretAt(blockId, blockTextLength(b as TextBearingBlock));
  }
  if (b.type === "img") return { blockId, path: [1], offset: 1 };
  if (b.type === "columns") {
    const cb = b as ColumnsBlock;
    const c = cb.cols - 1;
    const cell = cb.cells[c] ?? [];
    const len = cell.reduce((n, run) => n + run.text.length, 0);
    return { blockId, path: [c, len], offset: len };
  }
  // table — bottom-right cell, end of cell text
  const t = b as TableBlock;
  const r = t.rows - 1;
  const c = t.cols - 1;
  const cell = t.cells[r]?.[c] ?? [];
  const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
  return { blockId, path: [r, c, cellLen], offset: cellLen };
}

function blockMaxOffset(doc: DocState, blockId: string): number {
  const b = getBlock(doc, blockId);
  if (!b) return 0;
  if (isTextBearing(b)) return blockTextLength(b as TextBearingBlock);
  if (b.type === "img") return 1;
  // table cell offset extracted from path[2]
  return 0;
}

// ---------------------------------------------------------------------------
// Char-level navigation (handles cross-block movement)
// ---------------------------------------------------------------------------

/**
 * Move one character to the right. Crosses block boundaries: from the end of
 * block i to the start of block i+1. At end-of-doc, returns the same anchor.
 */
export function nextAnchor(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (!block) return a;
  const off = anchorOffset(a);
  // Tables — handle cell-internal motion first.
  if (block.type === "table") {
    return nextInTable(doc, block as TableBlock, a);
  }
  if (block.type === "img") {
    if (off === 0) return { blockId: a.blockId, path: [1], offset: 1 };
    // past the image — step into next block
    return stepIntoNextBlock(doc, a.blockId);
  }
  if (block.type === "columns") {
    return nextInColumns(doc, block as ColumnsBlock, a);
  }
  // text-bearing
  const max = blockTextLength(block as TextBearingBlock);
  if (off < max) return withCharOffset(a, off + 1);
  return stepIntoNextBlock(doc, a.blockId);
}

/**
 * Move one character to the left. Crosses block boundaries the same way.
 */
export function prevAnchor(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (!block) return a;
  const off = anchorOffset(a);
  if (block.type === "table") {
    return prevInTable(doc, block as TableBlock, a);
  }
  if (block.type === "img") {
    if (off === 1) return { blockId: a.blockId, path: [0], offset: 0 };
    return stepIntoPrevBlock(doc, a.blockId);
  }
  if (block.type === "columns") {
    return prevInColumns(doc, block as ColumnsBlock, a);
  }
  if (off > 0) return withCharOffset(a, off - 1);
  return stepIntoPrevBlock(doc, a.blockId);
}

function stepIntoNextBlock(doc: DocState, blockId: string): Anchor {
  const i = findPos(doc, blockId);
  const nextId = doc.order[i + 1];
  if (nextId == null) return endAnchorOfBlock(doc, blockId)!;
  return startAnchorOfBlock(doc, nextId)!;
}

function stepIntoPrevBlock(doc: DocState, blockId: string): Anchor {
  const i = findPos(doc, blockId);
  const prevId = doc.order[i - 1];
  if (prevId == null) return startAnchorOfBlock(doc, blockId)!;
  return endAnchorOfBlock(doc, prevId)!;
}

function nextInTable(doc: DocState, t: TableBlock, a: Anchor): Anchor {
  const r = a.path[0] ?? 0;
  const c = a.path[1] ?? 0;
  const off = a.path[2] ?? 0;
  const cell = t.cells[r]?.[c] ?? [];
  const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
  if (off < cellLen) {
    return { blockId: t.id, path: [r, c, off + 1], offset: off + 1 };
  }
  // end of cell — advance to next cell or step out of the table.
  if (c + 1 < t.cols) return { blockId: t.id, path: [r, c + 1, 0], offset: 0 };
  if (r + 1 < t.rows) return { blockId: t.id, path: [r + 1, 0, 0], offset: 0 };
  return stepIntoNextBlock(doc, t.id);
}

function nextInColumns(
  doc: DocState,
  cb: ColumnsBlock,
  a: Anchor,
): Anchor {
  const c = a.path[0] ?? 0;
  const off = a.path[1] ?? 0;
  const cell = cb.cells[c] ?? [];
  const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
  if (off < cellLen) {
    return { blockId: cb.id, path: [c, off + 1], offset: off + 1 };
  }
  if (c + 1 < cb.cols) return { blockId: cb.id, path: [c + 1, 0], offset: 0 };
  return stepIntoNextBlock(doc, cb.id);
}

function prevInColumns(
  doc: DocState,
  cb: ColumnsBlock,
  a: Anchor,
): Anchor {
  const c = a.path[0] ?? 0;
  const off = a.path[1] ?? 0;
  if (off > 0) return { blockId: cb.id, path: [c, off - 1], offset: off - 1 };
  if (c > 0) {
    const prev = cb.cells[c - 1] ?? [];
    const len = prev.reduce((n, run) => n + run.text.length, 0);
    return { blockId: cb.id, path: [c - 1, len], offset: len };
  }
  return stepIntoPrevBlock(doc, cb.id);
}

function prevInTable(doc: DocState, t: TableBlock, a: Anchor): Anchor {
  const r = a.path[0] ?? 0;
  const c = a.path[1] ?? 0;
  const off = a.path[2] ?? 0;
  if (off > 0) {
    return { blockId: t.id, path: [r, c, off - 1], offset: off - 1 };
  }
  // start of cell — back into previous cell, or step out.
  if (c > 0) {
    const prevCell = t.cells[r]?.[c - 1] ?? [];
    const len = prevCell.reduce((n, run) => n + run.text.length, 0);
    return { blockId: t.id, path: [r, c - 1, len], offset: len };
  }
  if (r > 0) {
    const lastCol = t.cols - 1;
    const prevCell = t.cells[r - 1]?.[lastCol] ?? [];
    const len = prevCell.reduce((n, run) => n + run.text.length, 0);
    return {
      blockId: t.id,
      path: [r - 1, lastCol, len],
      offset: len,
    };
  }
  return stepIntoPrevBlock(doc, t.id);
}

// ---------------------------------------------------------------------------
// Block-edge: Home / End
// ---------------------------------------------------------------------------

export function homeOfBlock(doc: DocState, a: Anchor): Anchor {
  return startAnchorOfBlock(doc, a.blockId) ?? a;
}

export function endOfBlock(doc: DocState, a: Anchor): Anchor {
  return endAnchorOfBlock(doc, a.blockId) ?? a;
}

// ---------------------------------------------------------------------------
// Doc edges
// ---------------------------------------------------------------------------

export function homeOfDoc(doc: DocState): Anchor {
  const id = doc.order[0];
  if (id == null) return { blockId: "", path: [0], offset: 0 };
  return startAnchorOfBlock(doc, id)!;
}

export function endOfDocAnchor(doc: DocState): Anchor {
  const id = doc.order[doc.order.length - 1];
  if (id == null) return { blockId: "", path: [0], offset: 0 };
  return endAnchorOfBlock(doc, id)!;
}

// ---------------------------------------------------------------------------
// Block-jumps (used as a fallback for ArrowUp/Down when measurement is
// unavailable — e.g. headless tests or blocks that haven't laid out yet).
// ---------------------------------------------------------------------------

export function blockAbove(doc: DocState, a: Anchor): Anchor {
  // For tables, vertical motion stays inside the table — move to the cell
  // directly above in the same column.
  const block = getBlock(doc, a.blockId);
  if (block?.type === "table") {
    const t = block as TableBlock;
    const r = a.path[0] ?? 0;
    const c = a.path[1] ?? 0;
    if (r > 0) {
      const cell = t.cells[r - 1]?.[c] ?? [];
      const len = runsLen(cell);
      const off = Math.min(a.path[2] ?? 0, len);
      return { blockId: t.id, path: [r - 1, c, off], offset: off };
    }
    // First row — exit upward to whatever block precedes the table.
    return stepIntoPrevBlock(doc, t.id);
  }
  const i = findPos(doc, a.blockId);
  if (i <= 0) return a;
  const prevId = doc.order[i - 1]!;
  const off = Math.min(anchorOffset(a), blockMaxOffset(doc, prevId));
  return { blockId: prevId, path: [off], offset: off };
}

export function blockBelow(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (block?.type === "table") {
    const t = block as TableBlock;
    const r = a.path[0] ?? 0;
    const c = a.path[1] ?? 0;
    if (r < t.rows - 1) {
      const cell = t.cells[r + 1]?.[c] ?? [];
      const len = runsLen(cell);
      const off = Math.min(a.path[2] ?? 0, len);
      return { blockId: t.id, path: [r + 1, c, off], offset: off };
    }
    return stepIntoNextBlock(doc, t.id);
  }
  const i = findPos(doc, a.blockId);
  if (i < 0 || i >= doc.order.length - 1) return a;
  const nextId = doc.order[i + 1]!;
  const off = Math.min(anchorOffset(a), blockMaxOffset(doc, nextId));
  return { blockId: nextId, path: [off], offset: off };
}

function runsLen(runs: InlineRun[]): number {
  let n = 0;
  for (const r of runs) n += r.text.length;
  return n;
}

// ---------------------------------------------------------------------------
// Word-level navigation — Cmd/Ctrl + Arrow on macOS / Windows.
// ---------------------------------------------------------------------------

/** Concatenate runs into a single string for word-boundary scanning. */
function runsText(runs: InlineRun[]): string {
  let s = "";
  for (const r of runs) s += r.text;
  return s;
}

function blockText(doc: DocState, blockId: string): string | null {
  const b = getBlock(doc, blockId);
  if (!b) return null;
  if (isTextBearing(b)) return runsText((b as TextBearingBlock).runs);
  if (b.type === "table") {
    // Word nav inside a table operates on the current cell only.
    return null;
  }
  return null;
}

function tableCellText(t: TableBlock, r: number, c: number): string {
  const cell = t.cells[r]?.[c] ?? [];
  return runsText(cell);
}

export function nextWord(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (!block) return a;
  if (block.type === "table") {
    const t = block as TableBlock;
    const r = a.path[0] ?? 0;
    const c = a.path[1] ?? 0;
    const off = a.path[2] ?? 0;
    const text = tableCellText(t, r, c);
    if (off < text.length) {
      const nx = nextWordOffset(text, off);
      return { blockId: t.id, path: [r, c, nx], offset: nx };
    }
    return nextAnchor(doc, a); // step into next cell / block
  }
  const text = blockText(doc, a.blockId);
  if (text == null) return nextAnchor(doc, a);
  const off = anchorOffset(a);
  if (off < text.length) {
    const nx = nextWordOffset(text, off);
    return withCharOffset(a, nx);
  }
  // At end of block — cross into next block at offset 0.
  return stepIntoNextBlock(doc, a.blockId);
}

export function prevWord(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (!block) return a;
  if (block.type === "table") {
    const t = block as TableBlock;
    const r = a.path[0] ?? 0;
    const c = a.path[1] ?? 0;
    const off = a.path[2] ?? 0;
    if (off > 0) {
      const text = tableCellText(t, r, c);
      const px = prevWordOffset(text, off);
      return { blockId: t.id, path: [r, c, px], offset: px };
    }
    return prevAnchor(doc, a);
  }
  const text = blockText(doc, a.blockId);
  if (text == null) return prevAnchor(doc, a);
  const off = anchorOffset(a);
  if (off > 0) {
    const px = prevWordOffset(text, off);
    return withCharOffset(a, px);
  }
  return stepIntoPrevBlock(doc, a.blockId);
}
