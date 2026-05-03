import { getBlock, updateBlock } from "../model/doc";
import {
  deleteRange,
  insertText as insertTextRuns,
} from "../model/blockText";
import { mergeBackward } from "./structuralCommands";
import { runsAt, runsLengthAt } from "../model/cellAccess";
import {
  anchorOffset,
  caret,
  caretAt,
  clampAnchor,
  isCaret,
  orderedRange,
  withCharOffset,
} from "../controller/selection";
import type { DocState, Selection } from "../model/types";
import type { Store } from "creo";

// ---------------------------------------------------------------------------
// Public command runners — each takes the docStore + selStore and mutates
// them. Returns true if anything changed (so callers can decide whether to
// schedule autosave / push undo).
// ---------------------------------------------------------------------------

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

/**
 * Insert plain text at the current selection. If the selection is a range,
 * the range is deleted first and the text is inserted at the start.
 *
 * Cross-block ranges are deferred to mergeBackward (M5) — this only handles
 * the single-cell / single-block case.
 */
export function insertText({ docStore, selStore }: Stores, text: string): boolean {
  if (text.length === 0) return false;
  const doc = docStore.get();
  const sel = selStore.get();

  if (sel.kind === "range") {
    const { start, end } = orderedRange(doc, sel);
    if (
      start.blockId === end.blockId &&
      samePathPrefix(start, end)
    ) {
      const block = getBlock(doc, start.blockId);
      if (!block) return false;
      const ctx = runsAt(block, start);
      if (!ctx) return false;
      const sOff = anchorOffset(start);
      const eOff = anchorOffset(end);
      const newRuns = insertTextRuns(
        deleteRange(ctx.runs, sOff, eOff),
        sOff,
        text,
      );
      docStore.set(updateBlock(doc, ctx.setRuns(newRuns)));
      selStore.set(caret(withCharOffset(start, sOff + text.length)));
      return true;
    }
    // Cross-block / cross-cell range: collapse first, then re-enter so
    // the caret-path below inserts at the resulting collapsed anchor.
    // mergeBackward() with a range routes through the structural-merge
    // collapse helper (which handles multi-block ranges + tables/columns)
    // and leaves a caret selection at the start of the deleted range.
    const collapsed = mergeBackward({ docStore, selStore });
    if (!collapsed) return false;
    return insertText({ docStore, selStore }, text);
  }

  const at = clampAnchor(doc, sel.at);
  const block = getBlock(doc, at.blockId);
  if (!block) return false;
  const ctx = runsAt(block, at);
  if (!ctx) return false;
  const off = anchorOffset(at);
  const newRuns = insertTextRuns(ctx.runs, off, text);
  docStore.set(updateBlock(doc, ctx.setRuns(newRuns)));
  selStore.set(caret(withCharOffset(at, off + text.length)));
  return true;
}

/** Delete one character backward, or collapse a range. */
export function deleteBackward({ docStore, selStore }: Stores): boolean {
  const doc = docStore.get();
  const sel = selStore.get();

  if (sel.kind === "range") {
    return deleteSelectionRange({ docStore, selStore }, doc, sel);
  }

  const at = clampAnchor(doc, sel.at);
  const block = getBlock(doc, at.blockId);
  if (!block) return false;
  const ctx = runsAt(block, at);
  if (!ctx) return false;
  const off = anchorOffset(at);
  if (off === 0) return false;
  const newRuns = deleteRange(ctx.runs, off - 1, off);
  docStore.set(updateBlock(doc, ctx.setRuns(newRuns)));
  selStore.set(caret(withCharOffset(at, off - 1)));
  return true;
}

/** Delete one character forward, or collapse a range. */
export function deleteForward({ docStore, selStore }: Stores): boolean {
  const doc = docStore.get();
  const sel = selStore.get();

  if (sel.kind === "range") {
    return deleteSelectionRange({ docStore, selStore }, doc, sel);
  }

  const at = clampAnchor(doc, sel.at);
  const block = getBlock(doc, at.blockId);
  if (!block) return false;
  const ctx = runsAt(block, at);
  if (!ctx) return false;
  const off = anchorOffset(at);
  const len = runsLengthAt(block, at);
  if (off >= len) return false;
  const newRuns = deleteRange(ctx.runs, off, off + 1);
  docStore.set(updateBlock(doc, ctx.setRuns(newRuns)));
  return true;
}

function deleteSelectionRange(
  stores: Stores,
  doc: DocState,
  sel: Selection,
): boolean {
  if (isCaret(sel)) return false;
  const { start, end } = orderedRange(doc, sel);
  if (start.blockId !== end.blockId || !samePathPrefix(start, end)) {
    // Cross-block / cross-cell — block-merge owns this in M5.
    return false;
  }
  const block = getBlock(doc, start.blockId);
  if (!block) return false;
  const ctx = runsAt(block, start);
  if (!ctx) return false;
  const sOff = anchorOffset(start);
  const eOff = anchorOffset(end);
  if (sOff === eOff) return false;
  const newRuns = deleteRange(ctx.runs, sOff, eOff);
  stores.docStore.set(updateBlock(doc, ctx.setRuns(newRuns)));
  // Place caret at start; preserve table path prefix.
  if (start.path.length >= 3) {
    stores.selStore.set(caret(withCharOffset(start, sOff)));
  } else {
    stores.selStore.set(caret(caretAt(block.id, sOff)));
  }
  return true;
}

/**
 * For range selections, both anchors must point into the SAME runs
 * container (same row/col for tables, both top-level for text blocks).
 */
function samePathPrefix(a: { path: number[] }, b: { path: number[] }): boolean {
  if (a.path.length !== b.path.length) {
    // text-bearing path is [offset]; table path is [row,col,offset]. Must match.
    return false;
  }
  if (a.path.length >= 3) {
    return a.path[0] === b.path[0] && a.path[1] === b.path[1];
  }
  return true;
}
