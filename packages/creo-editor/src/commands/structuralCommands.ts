import type { Store } from "creo";
import {
  blockTextLength,
  concatRuns,
  deleteRange,
  isTextBearing,
  splitRunsAt,
  type TextBearingBlock,
} from "../model/blockText";
import {
  findPos,
  getBlock,
  insertAfter,
  newBlockId,
  removeBlock,
  updateBlock,
} from "../model/doc";
import {
  anchorOffset,
  caret,
  caretAt,
  isCaret,
  orderedRange,
  withCharOffset,
} from "../controller/selection";
import type {
  Block,
  BlockSpec,
  BlockType,
  DocState,
  HeadingBlock,
  ListItemBlock,
  ParagraphBlock,
  Selection,
} from "../model/types";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/**
 * Split the current block at the caret. The right half becomes a NEW block
 * placed immediately after the current one. Headings split into a paragraph
 * (the convention every consumer-grade editor uses — pressing Enter at the
 * end of a heading shouldn't create another heading by default). List items
 * split into another list item of the same kind & depth.
 */
export function splitBlock({ docStore, selStore }: Stores): boolean {
  const sel = selStore.get();
  if (!isCaret(sel)) {
    // Range split: collapse the range first by deleting it, then split.
    const collapsed = collapseRangeForStructuralOp(docStore, selStore);
    if (collapsed === false) return false;
  }
  const doc = docStore.get();
  const cur = selStore.get();
  if (!isCaret(cur)) return false;

  const block = getBlock(doc, cur.at.blockId);
  if (!block || !isTextBearing(block)) return false;
  const off = anchorOffset(cur.at);
  const [left, right] = splitRunsAt(block.runs, off);

  // Same-id keeps the first half (cheap reuse). New id for the right half.
  const newId = newBlockId();
  const updatedLeft = {
    ...(block as TextBearingBlock),
    runs: left,
  } as Block;

  let nextBlock: BlockSpec;
  switch (block.type) {
    case "li": {
      const li = block as ListItemBlock;
      nextBlock = {
        id: newId,
        type: "li",
        ordered: li.ordered,
        depth: li.depth,
        runs: right,
      };
      break;
    }
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      // Heading → paragraph after split.
      nextBlock = { id: newId, type: "p", runs: right };
      break;
    case "p":
    default:
      nextBlock = { id: newId, type: "p", runs: right };
      break;
  }

  const d1 = updateBlock(doc, updatedLeft);
  const d2 = insertAfter(d1, block.id, nextBlock);
  docStore.set(d2);
  selStore.set(caret(caretAt(newId, 0)));
  return true;
}

// ---------------------------------------------------------------------------
// Merge backward (Backspace at offset 0)
// ---------------------------------------------------------------------------

export function mergeBackward({ docStore, selStore }: Stores): boolean {
  const sel = selStore.get();
  if (!isCaret(sel)) {
    return collapseRangeForStructuralOp(docStore, selStore) ?? false;
  }
  const doc = docStore.get();
  const at = sel.at;
  if (anchorOffset(at) !== 0) return false;
  const i = findPos(doc, at.blockId);
  if (i <= 0) return false;
  const prevId = doc.order[i - 1]!;
  const prev = getBlock(doc, prevId)!;
  const cur = getBlock(doc, at.blockId)!;

  if (!isTextBearing(prev) || !isTextBearing(cur)) {
    // Image / table on either side — collapse caret to end of prev block
    // instead of deleting (deferred to image/table handling).
    return false;
  }

  const prevLen = blockTextLength(prev as TextBearingBlock);
  const merged: TextBearingBlock = {
    ...(prev as TextBearingBlock),
    runs: concatRuns(
      (prev as TextBearingBlock).runs,
      (cur as TextBearingBlock).runs,
    ),
  };
  const d1 = updateBlock(doc, merged as Block);
  const d2 = removeBlock(d1, at.blockId);
  docStore.set(d2);
  selStore.set(caret(caretAt(prevId, prevLen)));
  return true;
}

// ---------------------------------------------------------------------------
// Merge forward (Delete at end of block)
// ---------------------------------------------------------------------------

export function mergeForward({ docStore, selStore }: Stores): boolean {
  const sel = selStore.get();
  if (!isCaret(sel)) {
    return collapseRangeForStructuralOp(docStore, selStore) ?? false;
  }
  const doc = docStore.get();
  const at = sel.at;
  const block = getBlock(doc, at.blockId);
  if (!block || !isTextBearing(block)) return false;
  const off = anchorOffset(at);
  const len = blockTextLength(block as TextBearingBlock);
  if (off !== len) return false;
  const i = findPos(doc, at.blockId);
  const nextId = doc.order[i + 1];
  if (nextId == null) return false;
  const next = getBlock(doc, nextId)!;
  if (!isTextBearing(next)) return false;
  const merged: TextBearingBlock = {
    ...(block as TextBearingBlock),
    runs: concatRuns(
      (block as TextBearingBlock).runs,
      (next as TextBearingBlock).runs,
    ),
  };
  const d1 = updateBlock(doc, merged as Block);
  const d2 = removeBlock(d1, nextId);
  docStore.set(d2);
  // Caret stays at the merge boundary.
  selStore.set(caret(withCharOffset(at, len)));
  return true;
}

// ---------------------------------------------------------------------------
// setBlockType — change the type of the current block (or the block holding
// the start of a range). Preserves runs.
// ---------------------------------------------------------------------------

export type SetBlockTypePayload = {
  type: BlockType;
  ordered?: boolean;
  depth?: 0 | 1 | 2 | 3;
};

export function setBlockType(
  { docStore, selStore }: Stores,
  payload: SetBlockTypePayload,
): boolean {
  const doc = docStore.get();
  const sel = selStore.get();
  const startId = isCaret(sel) ? sel.at.blockId : sel.anchor.blockId;
  const block = getBlock(doc, startId);
  if (!block) return false;
  if (!isTextBearing(block)) return false;
  const runs = (block as TextBearingBlock).runs;
  let next: Block;
  switch (payload.type) {
    case "p":
      next = {
        id: block.id,
        index: block.index,
        type: "p",
        runs,
      } satisfies ParagraphBlock;
      break;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      next = {
        id: block.id,
        index: block.index,
        type: payload.type,
        runs,
      } satisfies HeadingBlock;
      break;
    case "li":
      next = {
        id: block.id,
        index: block.index,
        type: "li",
        ordered: payload.ordered ?? false,
        depth: payload.depth ?? 0,
        runs,
      } satisfies ListItemBlock;
      break;
    default:
      // img / table can't be reached from text — payload misuse, skip.
      return false;
  }
  docStore.set(updateBlock(doc, next));
  return true;
}

// ---------------------------------------------------------------------------
// Range collapse helper — used by structural ops when the user has a range
// selected. Deletes the range across (potentially) multiple blocks first,
// leaving a caret at the start of the range, then returns true.
// Returns false (no-op) if the range can't be collapsed (e.g. spans an
// image block — handled in M9).
// ---------------------------------------------------------------------------

function collapseRangeForStructuralOp(
  docStore: Store<DocState>,
  selStore: Store<Selection>,
): boolean | null {
  const doc = docStore.get();
  const sel = selStore.get();
  if (sel.kind === "caret") return true;
  const { start, end } = orderedRange(doc, sel);
  if (start.blockId === end.blockId) {
    const block = getBlock(doc, start.blockId);
    if (!block || !isTextBearing(block)) return false;
    const sOff = anchorOffset(start);
    const eOff = anchorOffset(end);
    if (sOff === eOff) {
      selStore.set(caret(start));
      return true;
    }
    const newRuns = deleteRange((block as TextBearingBlock).runs, sOff, eOff);
    docStore.set(
      updateBlock(doc, {
        ...(block as TextBearingBlock),
        runs: newRuns,
      } as Block),
    );
    selStore.set(caret(caretAt(block.id, sOff)));
    return true;
  }
  // Multi-block range delete: keep the part of the start-block before sOff
  // and the part of the end-block after eOff, then merge them, and remove
  // every block in between.
  const startBlock = getBlock(doc, start.blockId);
  const endBlock = getBlock(doc, end.blockId);
  if (!startBlock || !endBlock || !isTextBearing(startBlock) || !isTextBearing(endBlock)) {
    return false;
  }
  const sOff = anchorOffset(start);
  const eOff = anchorOffset(end);
  const [leftRuns] = splitRunsAt((startBlock as TextBearingBlock).runs, sOff);
  const [, rightRuns] = splitRunsAt(
    (endBlock as TextBearingBlock).runs,
    eOff,
  );
  const merged = concatRuns(leftRuns, rightRuns);
  const startI = findPos(doc, start.blockId);
  const endI = findPos(doc, end.blockId);
  // Remove every block in (startI, endI] and replace startBlock's runs.
  let working = updateBlock(doc, {
    ...(startBlock as TextBearingBlock),
    runs: merged,
  } as Block);
  for (let i = endI; i > startI; i--) {
    const id = doc.order[i]!;
    working = removeBlock(working, id);
  }
  docStore.set(working);
  selStore.set(caret(caretAt(start.blockId, sOff)));
  return true;
}
