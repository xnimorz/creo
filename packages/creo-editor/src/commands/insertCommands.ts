import type { Store } from "creo";
import {
  concatRuns,
  deleteRange,
  isTextBearing,
  splitRunsAt,
  type TextBearingBlock,
} from "../model/blockText";
import {
  findPos,
  getBlock,
  insertManyAt,
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
} from "../controller/selection";
import type {
  Block,
  BlockSpec,
  DocState,
  ListItemBlock,
  Selection,
} from "../model/types";
import type { TextBearingBlock as TBB } from "../model/blockText";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

/**
 * Insert a list of pre-parsed blocks at the current caret. If the selection
 * is a range, it is collapsed first.
 *
 * Splice rules (matches every consumer rich-text editor I'm aware of):
 *  - Single text-bearing block: inline-merge into the current block.
 *  - Multiple blocks: split the current block at the caret; the first
 *    pasted block's runs join the LEFT half, the last pasted block's runs
 *    are followed by the RIGHT half (in a new block of the last one's
 *    type), and any blocks in between are inserted as new blocks.
 *  - Non-text blocks (img / table): always become a separate block, with
 *    the surrounding paragraph split if needed.
 */
export function insertBlocks(stores: Stores, blocks: BlockSpec[]): boolean {
  if (blocks.length === 0) return false;

  // Collapse ranges first by deleting them.
  if (stores.selStore.get().kind === "range") {
    if (!collapseRange(stores)) return false;
  }

  const doc = stores.docStore.get();
  const sel = stores.selStore.get();
  if (!isCaret(sel)) return false;
  const at = sel.at;
  const cur = getBlock(doc, at.blockId);
  if (!cur) return false;

  // Caret must be inside a text-bearing block to splice cleanly. If it's an
  // image / table block, paste produces blocks AFTER the current block.
  if (!isTextBearing(cur)) {
    return insertBlocksAfter(stores, at.blockId, blocks);
  }

  // ---- Fast path: single text-bearing block → inline merge ----
  if (blocks.length === 1) {
    const only = blocks[0]!;
    if (isTextBearing(only as Block)) {
      return inlineMerge(stores, cur as TBB, anchorOffset(at), only);
    }
  }

  // ---- General path ----
  return splitAndInsert(stores, cur as TBB, anchorOffset(at), blocks);
}

function inlineMerge(
  stores: Stores,
  cur: TBB,
  off: number,
  insertedSpec: BlockSpec,
): boolean {
  const inserted = ensureBlock(insertedSpec);
  if (!isTextBearing(inserted)) return false;
  const insertedRuns = (inserted as TBB).runs;
  const [left, right] = splitRunsAt(cur.runs, off);
  const merged = concatRuns(concatRuns(left, insertedRuns), right);
  const newBlock: Block = { ...cur, runs: merged } as Block;
  stores.docStore.set(updateBlock(stores.docStore.get(), newBlock));
  let totalInserted = 0;
  for (const r of insertedRuns) totalInserted += r.text.length;
  stores.selStore.set(caret(caretAt(cur.id, off + totalInserted)));
  return true;
}

function splitAndInsert(
  stores: Stores,
  cur: TBB,
  off: number,
  blocks: BlockSpec[],
): boolean {
  const [leftRuns, rightRuns] = splitRunsAt(cur.runs, off);
  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  // If the current block is completely empty (no runs at all), let the
  // first pasted block's TYPE win: pasting a heading into an empty paragraph
  // should leave a heading, not a paragraph with the heading's text.
  const curIsEmpty = leftRuns.length === 0 && rightRuns.length === 0;

  let workingDoc = stores.docStore.get();
  if (isTextBearingSpec(first)) {
    const firstRuns = (first as Extract<BlockSpec, { runs: unknown }> & {
      runs: TBB["runs"];
    }).runs;
    const newCurRuns = concatRuns(leftRuns, firstRuns);
    if (curIsEmpty) {
      // Replace current block in place, adopting the first block's type.
      const replacement = upgradeBlockToSpec(cur, first, newCurRuns);
      workingDoc = updateBlock(workingDoc, replacement);
    } else {
      workingDoc = updateBlock(workingDoc, {
        ...cur,
        runs: newCurRuns,
      } as Block);
    }
  } else {
    // First inserted block is non-text (img / table) — keep current block's
    // left runs as-is, then we'll insert `first` as a new block right after.
    workingDoc = updateBlock(workingDoc, { ...cur, runs: leftRuns } as Block);
  }

  // Build the list of NEW blocks to insert after `cur`. That includes:
  //  - `first` as its own block IF non-text.
  //  - Every middle block as-is.
  //  - `last` as its own block, with rightRuns appended if last is text.
  const newBlocks: BlockSpec[] = [];
  if (!isTextBearingSpec(first)) {
    newBlocks.push(first);
  }
  for (let i = 1; i < blocks.length - 1; i++) {
    newBlocks.push(blocks[i]!);
  }
  if (blocks.length > 1) {
    if (isTextBearingSpec(last)) {
      newBlocks.push(
        appendRunsToTextSpec(last, rightRuns, /*newId*/ true),
      );
    } else {
      newBlocks.push(last);
      // The rightRuns need their own block since the non-text last can't
      // hold them.
      if (rightRuns.length) {
        newBlocks.push({
          id: newBlockId(),
          type: "p",
          runs: rightRuns,
        });
      }
    }
  } else {
    // Single non-text block: rightRuns go into a new paragraph after it.
    if (rightRuns.length) {
      newBlocks.push({
        id: newBlockId(),
        type: "p",
        runs: rightRuns,
      });
    }
  }

  const curPos = findPos(workingDoc, cur.id);
  workingDoc = insertManyAt(workingDoc, curPos + 1, newBlocks);
  stores.docStore.set(workingDoc);

  // Place caret at the END of the last inserted block's "logical content"
  // — that's the end of `last`'s runs (before rightRuns are appended).
  const lastInsertedBlock = (() => {
    if (blocks.length > 1 && isTextBearingSpec(last)) {
      // Find the new block id we created via appendRunsToTextSpec.
      // We pushed it last in newBlocks (or second-to-last for non-text last).
      return newBlocks[newBlocks.length - 1]!;
    }
    if (blocks.length === 1 && !isTextBearingSpec(last)) {
      // Single non-text block — caret right after it.
      return newBlocks[0]!;
    }
    // Default: caret stays at end of cur's new text.
    return null;
  })();

  if (lastInsertedBlock && isTextBearingSpec(lastInsertedBlock)) {
    const lastSpec = lastInsertedBlock as Extract<BlockSpec, { runs: unknown }>;
    let originalLen = 0;
    if (isTextBearingSpec(last)) {
      const lastRuns = (last as Extract<BlockSpec, { runs: unknown }> & {
        runs: TBB["runs"];
      }).runs;
      for (const r of lastRuns) originalLen += r.text.length;
    } else {
      originalLen = 0;
    }
    void lastSpec;
    stores.selStore.set(
      caret(caretAt(lastInsertedBlock.id!, originalLen)),
    );
  } else if (blocks.length === 1 && !isTextBearingSpec(first)) {
    // Caret after the inserted non-text block — sit at start of next block.
    const newCurEnd = (cur.runs ? sumRuns(leftRuns) : 0);
    stores.selStore.set(caret(caretAt(cur.id, newCurEnd)));
  } else if (blocks.length === 1 && isTextBearingSpec(first)) {
    // Already handled by inlineMerge fast path; defensive default:
    stores.selStore.set(caret(caretAt(cur.id, off)));
  }

  return true;
}

function insertBlocksAfter(
  stores: Stores,
  afterId: string,
  blocks: BlockSpec[],
): boolean {
  const doc = stores.docStore.get();
  const pos = findPos(doc, afterId) + 1;
  const next = insertManyAt(doc, pos, blocks);
  stores.docStore.set(next);
  // Caret to start of last inserted block.
  const lastId = blocks[blocks.length - 1]!.id ?? "";
  if (lastId) stores.selStore.set(caret(caretAt(lastId, 0)));
  return true;
}

// ---------------------------------------------------------------------------
// insertImage / insertTable convenience shims (used by M8/M9)
// ---------------------------------------------------------------------------

export function insertImage(
  stores: Stores,
  payload: { src: string; alt?: string; width?: number; height?: number },
): boolean {
  const block: BlockSpec = {
    id: newBlockId(),
    type: "img",
    src: payload.src,
    alt: payload.alt,
    width: payload.width,
    height: payload.height,
  };
  return insertBlocks(stores, [block]);
}

export function insertColumns(
  stores: Stores,
  payload: { cols: number },
): boolean {
  const cells: { text: string }[][] = [];
  for (let c = 0; c < payload.cols; c++) cells.push([]);
  const block: BlockSpec = {
    id: newBlockId(),
    type: "columns",
    cols: payload.cols,
    cells,
  };
  return insertBlocks(stores, [block]);
}

export function insertTable(
  stores: Stores,
  payload: { rows: number; cols: number },
): boolean {
  const cells: { text: string }[][][] = [];
  for (let r = 0; r < payload.rows; r++) {
    const row: { text: string }[][] = [];
    for (let c = 0; c < payload.cols; c++) row.push([]);
    cells.push(row);
  }
  const block: BlockSpec = {
    id: newBlockId(),
    type: "table",
    rows: payload.rows,
    cols: payload.cols,
    cells,
  };
  return insertBlocks(stores, [block]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a block that keeps `cur`'s id + index but takes its TYPE / extra
 * fields from `spec`. Used when pasting into an empty block — we want the
 * pasted block's type to win.
 */
function upgradeBlockToSpec(
  cur: TBB,
  spec: BlockSpec,
  runs: TBB["runs"],
): Block {
  switch (spec.type) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return { id: cur.id, index: cur.index, type: spec.type, runs } as Block;
    case "li":
      return {
        id: cur.id,
        index: cur.index,
        type: "li",
        ordered: (spec as ListItemBlock).ordered,
        depth: (spec as ListItemBlock).depth ?? 0,
        runs,
      } as Block;
    default:
      return { ...cur, runs } as Block;
  }
}

function isTextBearingSpec(spec: BlockSpec): boolean {
  return (
    spec.type === "p" ||
    spec.type === "h1" ||
    spec.type === "h2" ||
    spec.type === "h3" ||
    spec.type === "h4" ||
    spec.type === "h5" ||
    spec.type === "h6" ||
    spec.type === "li"
  );
}

function ensureBlock(spec: BlockSpec): Block {
  // `BlockSpec` lacks `index`; the doc layer assigns one when actually
  // inserting via insertManyAt. For helpers that just need to inspect runs
  // we cast — the index field is never read here.
  return spec as unknown as Block;
}

function sumRuns(runs: TBB["runs"]): number {
  let n = 0;
  for (const r of runs) n += r.text.length;
  return n;
}

function appendRunsToTextSpec(
  spec: BlockSpec,
  rightRuns: TBB["runs"],
  newId: boolean,
): BlockSpec {
  const id = newId ? newBlockId() : spec.id;
  const baseRuns = (spec as Extract<BlockSpec, { runs: unknown }> & {
    runs: TBB["runs"];
  }).runs;
  const merged = concatRuns(baseRuns, rightRuns);
  switch (spec.type) {
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return { id, type: spec.type, runs: merged };
    case "li":
      return {
        id,
        type: "li",
        ordered: (spec as ListItemBlock).ordered,
        depth: (spec as ListItemBlock).depth ?? 0,
        runs: merged,
      };
    default:
      return spec;
  }
}

function collapseRange(stores: Stores): boolean {
  const doc = stores.docStore.get();
  const sel = stores.selStore.get();
  if (sel.kind === "caret") return true;
  const { start, end } = orderedRange(doc, sel);
  if (start.blockId === end.blockId) {
    const block = getBlock(doc, start.blockId);
    if (!block || !isTextBearing(block)) return false;
    const sOff = anchorOffset(start);
    const eOff = anchorOffset(end);
    if (sOff === eOff) {
      stores.selStore.set(caret(start));
      return true;
    }
    const newRuns = deleteRange((block as TBB).runs, sOff, eOff);
    stores.docStore.set(
      updateBlock(doc, {
        ...(block as TBB),
        runs: newRuns,
      } as Block),
    );
    stores.selStore.set(caret(caretAt(block.id, sOff)));
    return true;
  }
  // Multi-block range: lean on structuralCommands' helper logic by
  // delegating through mergeBackward/mergeForward semantics is messy here,
  // so we re-implement a slim version inline.
  const startBlock = getBlock(doc, start.blockId);
  const endBlock = getBlock(doc, end.blockId);
  if (
    !startBlock ||
    !endBlock ||
    !isTextBearing(startBlock) ||
    !isTextBearing(endBlock)
  ) {
    return false;
  }
  const sOff = anchorOffset(start);
  const eOff = anchorOffset(end);
  const [leftRuns] = splitRunsAt((startBlock as TBB).runs, sOff);
  const [, rightRuns] = splitRunsAt((endBlock as TBB).runs, eOff);
  const merged = concatRuns(leftRuns, rightRuns);
  const startI = findPos(doc, start.blockId);
  const endI = findPos(doc, end.blockId);
  let working = updateBlock(doc, {
    ...(startBlock as TBB),
    runs: merged,
  } as Block);
  for (let i = endI; i > startI; i--) {
    working = removeBlock(working, doc.order[i]!);
  }
  stores.docStore.set(working);
  stores.selStore.set(caret(caretAt(start.blockId, sOff)));
  return true;
}
