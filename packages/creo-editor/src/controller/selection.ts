import { findPos, getBlock } from "../model/doc";
import {
  blockTextLength,
  isTextBearing,
  type TextBearingBlock,
} from "../model/blockText";
import type {
  Anchor,
  Block,
  BlockId,
  ColumnsBlock,
  DocState,
  Selection,
  TableBlock,
} from "../model/types";

// ---------------------------------------------------------------------------
// Anchor builders
// ---------------------------------------------------------------------------

export function caretAt(blockId: BlockId, offset: number): Anchor {
  return { blockId, path: [offset], offset };
}

export function caret(at: Anchor): Selection {
  return { kind: "caret", at };
}

export function range(anchor: Anchor, focus: Anchor): Selection {
  return { kind: "range", anchor, focus };
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export function anchorOffset(a: Anchor): number {
  // Path encodings:
  //   text-bearing:  [charOffset]
  //   columns:       [colIndex, charOffset]
  //   tables:        [row, col, charOffset]
  if (a.path.length >= 3) return a.path[2]!;
  if (a.path.length === 2) return a.path[1]!;
  if (a.path.length >= 1) return a.path[0]!;
  return a.offset;
}

export function withCharOffset(a: Anchor, offset: number): Anchor {
  if (a.path.length >= 3) {
    return {
      ...a,
      path: [a.path[0]!, a.path[1]!, offset],
      offset,
    };
  }
  if (a.path.length === 2) {
    return { ...a, path: [a.path[0]!, offset], offset };
  }
  return { ...a, path: [offset], offset };
}

/** Returns true when the selection is a collapsed caret. */
export function isCaret(s: Selection): s is { kind: "caret"; at: Anchor } {
  return s.kind === "caret";
}

/** Same anchor & focus → effectively a caret. */
export function selectionStart(s: Selection): Anchor {
  return s.kind === "caret" ? s.at : s.anchor;
}

export function selectionEnd(s: Selection): Anchor {
  return s.kind === "caret" ? s.at : s.focus;
}

/** Compares two anchors that point into the same doc. Returns -1/0/+1. */
export function compareAnchors(
  doc: DocState,
  a: Anchor,
  b: Anchor,
): number {
  if (a.blockId === b.blockId) {
    // Same block — compare by path lexicographically, longer path wins ties.
    const al = a.path.length;
    const bl = b.path.length;
    const n = Math.min(al, bl);
    for (let i = 0; i < n; i++) {
      const ai = a.path[i]!;
      const bi = b.path[i]!;
      if (ai !== bi) return ai < bi ? -1 : 1;
    }
    if (al !== bl) return al < bl ? -1 : 1;
    return 0;
  }
  const ai = findPos(doc, a.blockId);
  const bi = findPos(doc, b.blockId);
  if (ai === bi) return 0;
  return ai < bi ? -1 : 1;
}

/** Anchor in document-order start..end ascending. */
export function orderedRange(
  doc: DocState,
  s: Selection,
): { start: Anchor; end: Anchor } {
  if (s.kind === "caret") return { start: s.at, end: s.at };
  return compareAnchors(doc, s.anchor, s.focus) <= 0
    ? { start: s.anchor, end: s.focus }
    : { start: s.focus, end: s.anchor };
}

// ---------------------------------------------------------------------------
// Clamping
// ---------------------------------------------------------------------------

/** Clamp an anchor so it points at a valid offset inside its block. */
export function clampAnchor(doc: DocState, a: Anchor): Anchor {
  const block = getBlock(doc, a.blockId);
  if (!block) {
    // Block was removed — fall back to the doc's first block, offset 0.
    const firstId = doc.order[0];
    if (firstId == null) {
      return { blockId: "", path: [0], offset: 0 };
    }
    return caretAt(firstId, 0);
  }
  return clampAnchorInBlock(block, a);
}

function clampAnchorInBlock(block: Block, a: Anchor): Anchor {
  if (isTextBearing(block)) {
    const max = blockTextLength(block as TextBearingBlock);
    const offset = Math.max(0, Math.min(max, anchorOffset(a)));
    return withCharOffset({ ...a, blockId: block.id }, offset);
  }
  if (block.type === "img") {
    const side = a.path[0] === 1 ? 1 : 0;
    return {
      blockId: block.id,
      path: [side],
      offset: side,
    };
  }
  if (block.type === "columns") {
    const cb = block as ColumnsBlock;
    const c = Math.max(0, Math.min(cb.cols - 1, a.path[0] ?? 0));
    const cell = cb.cells[c] ?? [];
    const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
    const off = Math.max(0, Math.min(cellLen, a.path[1] ?? 0));
    return { blockId: block.id, path: [c, off], offset: off };
  }
  // table
  const t = block as TableBlock;
  const r = Math.max(0, Math.min(t.rows - 1, a.path[0] ?? 0));
  const c = Math.max(0, Math.min(t.cols - 1, a.path[1] ?? 0));
  const cell = t.cells[r]?.[c] ?? [];
  const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
  const off = Math.max(0, Math.min(cellLen, a.path[2] ?? 0));
  return { blockId: block.id, path: [r, c, off], offset: off };
}

export function clampSelection(doc: DocState, s: Selection): Selection {
  if (s.kind === "caret") return caret(clampAnchor(doc, s.at));
  return range(clampAnchor(doc, s.anchor), clampAnchor(doc, s.focus));
}

// ---------------------------------------------------------------------------
// End-of-doc convenience — used by the input pipeline as an initial cursor.
// ---------------------------------------------------------------------------

export function endOfDoc(doc: DocState): Anchor {
  const lastId = doc.order[doc.order.length - 1];
  if (lastId == null) return { blockId: "", path: [0], offset: 0 };
  const last = doc.byId.get(lastId)!;
  if (isTextBearing(last)) {
    const len = blockTextLength(last as TextBearingBlock);
    return caretAt(lastId, len);
  }
  if (last.type === "img") {
    return { blockId: lastId, path: [1], offset: 1 };
  }
  if (last.type === "columns") {
    const cb = last as ColumnsBlock;
    const c = cb.cols - 1;
    const cell = cb.cells[c] ?? [];
    const len = cell.reduce((n, run) => n + run.text.length, 0);
    return { blockId: lastId, path: [c, len], offset: len };
  }
  // table — bottom-right cell, end of cell text.
  const t = last as TableBlock;
  const r = t.rows - 1;
  const c = t.cols - 1;
  const cell = t.cells[r]?.[c] ?? [];
  const cellLen = cell.reduce((n, run) => n + run.text.length, 0);
  return { blockId: lastId, path: [r, c, cellLen], offset: cellLen };
}
