import type { Pos } from "../model/types";
import { createPos } from "../model/types";

// ── Selection ──────────────────────────────────────────────────────────

export interface Selection {
  /** The fixed end of the selection (where the user started selecting). */
  readonly anchor: Pos;
  /** The moving end of the selection (where the cursor is). */
  readonly head: Pos;
}

export function createSelection(anchor: Pos | number, head?: Pos | number): Selection {
  const a = typeof anchor === "number" ? createPos(anchor) : anchor;
  const h = head !== undefined ? (typeof head === "number" ? createPos(head) : head) : a;
  return { anchor: a, head: h };
}

/** Get the leftmost position (start) of a selection. */
export function selFrom(sel: Selection): Pos {
  return (sel.anchor as number) <= (sel.head as number) ? sel.anchor : sel.head;
}

/** Get the rightmost position (end) of a selection. */
export function selTo(sel: Selection): Pos {
  return (sel.anchor as number) >= (sel.head as number) ? sel.anchor : sel.head;
}

/** Whether the selection is collapsed (cursor, no range). */
export function selIsEmpty(sel: Selection): boolean {
  return (sel.anchor as number) === (sel.head as number);
}

// ── Multi-selection ────────────────────────────────────────────────────

export interface MultiSelection {
  /** All selection ranges, sorted by `from` position. Non-overlapping. */
  readonly ranges: readonly Selection[];
  /** Index of the primary (most recently created) cursor. */
  readonly primary: number;
}

export function createMultiSelection(
  ranges: readonly Selection[],
  primary: number = 0,
): MultiSelection {
  if (ranges.length === 0) {
    throw new Error("MultiSelection must have at least one range");
  }
  if (primary < 0 || primary >= ranges.length) {
    throw new Error(`Primary index ${primary} out of range [0, ${ranges.length})`);
  }

  // Sort ranges by from position, merge overlapping
  const sorted = [...ranges].sort((a, b) => (selFrom(a) as number) - (selFrom(b) as number));
  const merged: Selection[] = [sorted[0]!];
  let adjustedPrimary = primary;

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1]!;
    const curr = sorted[i]!;

    if ((selFrom(curr) as number) <= (selTo(prev) as number)) {
      // Overlapping — merge into the previous range
      const newFrom = Math.min(selFrom(prev) as number, selFrom(curr) as number);
      const newTo = Math.max(selTo(prev) as number, selTo(curr) as number);
      merged[merged.length - 1] = createSelection(newFrom, newTo);

      // Adjust primary index if it was pointing at a merged range
      if (adjustedPrimary >= merged.length) {
        adjustedPrimary = merged.length - 1;
      }
    } else {
      merged.push(curr);
    }
  }

  if (adjustedPrimary >= merged.length) {
    adjustedPrimary = merged.length - 1;
  }

  return { ranges: merged, primary: adjustedPrimary };
}

/** Create a single-cursor multi-selection. */
export function singleSelection(pos: Pos | number): MultiSelection {
  return createMultiSelection([createSelection(pos)]);
}

/** Map selection positions through a position mapping function. */
export function mapSelection(
  sel: Selection,
  mapPos: (pos: Pos) => Pos,
): Selection {
  return createSelection(mapPos(sel.anchor), mapPos(sel.head));
}

export function mapMultiSelection(
  multi: MultiSelection,
  mapPos: (pos: Pos) => Pos,
): MultiSelection {
  return createMultiSelection(
    multi.ranges.map(r => mapSelection(r, mapPos)),
    multi.primary,
  );
}
