import type { Store } from "creo";
import {
  isTextBearing,
  normalizeRuns,
  splitRunsAt,
  type TextBearingBlock,
} from "../model/blockText";
import { findPos, getBlock, updateBlock } from "../model/doc";
import {
  anchorOffset,
  isCaret,
  orderedRange,
} from "../controller/selection";
import type {
  Block,
  DocState,
  InlineRun,
  Mark,
  Selection,
} from "../model/types";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

/**
 * Toggle a mark over the current selection.
 *
 * Behaviour:
 *  - Caret-only: no-op (real editors track a "pending mark" that biases the
 *    next character; we don't ship that in M6 to keep the API minimal).
 *  - Single-block range: if every character in [start, end) already has the
 *    mark, REMOVE it; otherwise ADD it everywhere in the range.
 *  - Cross-block range: same rule applied per-block to the slice that
 *    intersects the range.
 *
 * Run merging happens via `normalizeRuns`, so toggling repeatedly never
 * fragments runs unbounded.
 */
export function toggleMark({ docStore, selStore }: Stores, mark: Mark): boolean {
  const sel = selStore.get();
  if (isCaret(sel)) return false;
  const doc = docStore.get();
  const { start, end } = orderedRange(doc, sel);

  const startI = findPos(doc, start.blockId);
  const endI = findPos(doc, end.blockId);
  if (startI < 0 || endI < 0) return false;

  // First pass: figure out whether the entire selection already has the mark
  // (so we know whether to add or remove). We must inspect every char in the
  // covered slices.
  let allHave = true;
  let touchedAny = false;
  for (let i = startI; i <= endI; i++) {
    const id = doc.order[i]!;
    const block = getBlock(doc, id);
    if (!block || !isTextBearing(block)) continue;
    const sOff = i === startI ? anchorOffset(start) : 0;
    const eOff =
      i === endI ? anchorOffset(end) : runsLength((block as TextBearingBlock).runs);
    if (sOff === eOff) continue;
    touchedAny = true;
    const runs = (block as TextBearingBlock).runs;
    if (!sliceAllHasMark(runs, sOff, eOff, mark)) {
      allHave = false;
      break;
    }
  }
  if (!touchedAny) return false;

  const add = !allHave;

  // Second pass: write the change.
  let working = doc;
  for (let i = startI; i <= endI; i++) {
    const id = doc.order[i]!;
    const block = getBlock(working, id);
    if (!block || !isTextBearing(block)) continue;
    const blockLen = runsLength((block as TextBearingBlock).runs);
    const sOff = i === startI ? anchorOffset(start) : 0;
    const eOff = i === endI ? anchorOffset(end) : blockLen;
    if (sOff === eOff) continue;
    const runs = (block as TextBearingBlock).runs;
    const newRuns = applyMarkToSlice(runs, sOff, eOff, mark, add);
    working = updateBlock(working, {
      ...(block as TextBearingBlock),
      runs: newRuns,
    } as Block);
  }
  docStore.set(working);
  return true;
}

function runsLength(runs: InlineRun[]): number {
  let n = 0;
  for (const r of runs) n += r.text.length;
  return n;
}

function sliceAllHasMark(
  runs: InlineRun[],
  start: number,
  end: number,
  mark: Mark,
): boolean {
  let prefix = 0;
  for (const r of runs) {
    const rs = prefix;
    const re = prefix + r.text.length;
    prefix = re;
    if (re <= start || rs >= end) continue;
    if (!r.marks || !r.marks.has(mark)) return false;
  }
  return true;
}

function applyMarkToSlice(
  runs: InlineRun[],
  start: number,
  end: number,
  mark: Mark,
  add: boolean,
): InlineRun[] {
  const [left, midRight] = splitRunsAt(runs, start);
  const [middle, right] = splitRunsAt(midRight, end - start);
  const newMiddle = middle.map((r) => withMark(r, mark, add));
  return normalizeRuns([...left, ...newMiddle, ...right]);
}

function withMark(run: InlineRun, mark: Mark, add: boolean): InlineRun {
  const cur = run.marks ?? new Set<Mark>();
  const next = new Set<Mark>(cur);
  if (add) next.add(mark);
  else next.delete(mark);
  if (next.size === 0) return { text: run.text };
  return { text: run.text, marks: next };
}
