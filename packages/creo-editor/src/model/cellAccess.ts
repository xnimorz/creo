import type {
  Anchor,
  Block,
  ColumnsBlock,
  InlineRun,
  TableBlock,
} from "./types";
import { isTextBearing, type TextBearingBlock } from "./blockText";

/**
 * Resolve the runs container that the anchor points into, plus a setter
 * that produces an updated `Block` with new runs.
 *
 * For text-bearing blocks the runs are `block.runs`; for tables they live
 * inside `block.cells[r][c]` (path = [row, col, charOffset]).
 *
 * Returns null when the anchor doesn't point at a runs container — e.g.
 * an image block.
 */
export type RunsCtx = {
  runs: InlineRun[];
  setRuns: (newRuns: InlineRun[]) => Block;
};

export function runsAt(block: Block, anchor: Anchor): RunsCtx | null {
  if (isTextBearing(block)) {
    const tb = block as TextBearingBlock;
    return {
      runs: tb.runs,
      setRuns: (newRuns) => ({ ...tb, runs: newRuns } as Block),
    };
  }
  if (block.type === "table") {
    const t = block as TableBlock;
    const r = anchor.path[0] ?? 0;
    const c = anchor.path[1] ?? 0;
    if (r < 0 || r >= t.rows || c < 0 || c >= t.cols) return null;
    const runs = t.cells[r]?.[c] ?? [];
    return {
      runs,
      setRuns: (newRuns) => {
        const cells = t.cells.map((row, rr) =>
          rr === r ? row.map((cell, cc) => (cc === c ? newRuns : cell)) : row,
        );
        return { ...t, cells } as Block;
      },
    };
  }
  if (block.type === "columns") {
    const cb = block as ColumnsBlock;
    // Path: [colIndex, charOffset].
    const c = anchor.path[0] ?? 0;
    if (c < 0 || c >= cb.cols) return null;
    const runs = cb.cells[c] ?? [];
    return {
      runs,
      setRuns: (newRuns) => {
        const cells = cb.cells.map((cell, cc) => (cc === c ? newRuns : cell));
        return { ...cb, cells } as Block;
      },
    };
  }
  return null;
}

/** Total length of the runs container at `anchor`. */
export function runsLengthAt(block: Block, anchor: Anchor): number {
  const ctx = runsAt(block, anchor);
  if (!ctx) return 0;
  let n = 0;
  for (const r of ctx.runs) n += r.text.length;
  return n;
}
