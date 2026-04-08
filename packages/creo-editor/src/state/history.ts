/**
 * History plugin — undo/redo with transaction grouping.
 *
 * Transactions within a short time window are grouped together.
 * Undo reverses the most recent group. Redo re-applies it.
 */

import type { BlockNode } from "../model/types";
import type { Step } from "./editor-state";
import type { MultiSelection } from "./selection";

// ── Types ──────────────────────────────────────────────────────────────

export interface HistoryEntry {
  /** Steps that were applied (for redo). */
  readonly steps: readonly Step[];
  /** Selection before the steps were applied (for undo cursor restore). */
  readonly selectionBefore: MultiSelection;
  /** Selection after the steps were applied (for redo cursor restore). */
  readonly selectionAfter: MultiSelection;
  /** Document before the steps (for undo — we snapshot instead of inverting). */
  readonly docBefore: BlockNode;
  /** Timestamp when this entry was created. */
  readonly time: number;
}

export interface HistoryState {
  readonly undoStack: readonly HistoryEntry[];
  readonly redoStack: readonly HistoryEntry[];
}

export interface HistoryConfig {
  /** Max number of undo entries. Default: 200. */
  readonly maxEntries?: number;
  /** Time window (ms) for grouping consecutive edits. Default: 500. */
  readonly groupingDelay?: number;
}

// ── History implementation ─────────────────────────────────────────────

export function createHistory(config: HistoryConfig = {}): History {
  const maxEntries = config.maxEntries ?? 200;
  const groupingDelay = config.groupingDelay ?? 500;

  let state: HistoryState = {
    undoStack: [],
    redoStack: [],
  };

  return {
    get state() {
      return state;
    },

    get canUndo() {
      return state.undoStack.length > 0;
    },

    get canRedo() {
      return state.redoStack.length > 0;
    },

    record(
      steps: readonly Step[],
      selectionBefore: MultiSelection,
      selectionAfter: MultiSelection,
      docBefore: BlockNode,
    ) {
      if (steps.length === 0) return;

      const now = Date.now();
      const undoStack = [...state.undoStack];
      const lastEntry = undoStack[undoStack.length - 1];

      // Group with previous entry if within the time window
      if (lastEntry && now - lastEntry.time < groupingDelay) {
        undoStack[undoStack.length - 1] = {
          steps: [...lastEntry.steps, ...steps],
          selectionBefore: lastEntry.selectionBefore, // keep original selection
          selectionAfter,
          docBefore: lastEntry.docBefore, // keep original doc
          time: now,
        };
      } else {
        undoStack.push({
          steps,
          selectionBefore,
          selectionAfter,
          docBefore,
          time: now,
        });
      }

      // Trim stack if over max
      while (undoStack.length > maxEntries) {
        undoStack.shift();
      }

      state = {
        undoStack,
        redoStack: [], // Any new edit clears the redo stack
      };
    },

    undo(): UndoResult | null {
      if (state.undoStack.length === 0) return null;

      const undoStack = [...state.undoStack];
      const entry = undoStack.pop()!;

      const redoStack = [...state.redoStack, entry];

      state = { undoStack, redoStack };

      return {
        doc: entry.docBefore,
        selection: entry.selectionBefore,
      };
    },

    redo(): RedoResult | null {
      if (state.redoStack.length === 0) return null;

      const redoStack = [...state.redoStack];
      const entry = redoStack.pop()!;

      // The redo entry contains the steps to re-apply
      // But since we snapshot docs, we just replay the steps
      const undoStack = [...state.undoStack, entry];

      state = { undoStack, redoStack };

      return {
        steps: entry.steps,
        selection: entry.selectionAfter,
      };
    },

    clear() {
      state = { undoStack: [], redoStack: [] };
    },
  };
}

export interface History {
  readonly state: HistoryState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  /** Record a set of steps for potential undo. */
  record(
    steps: readonly Step[],
    selectionBefore: MultiSelection,
    selectionAfter: MultiSelection,
    docBefore: BlockNode,
  ): void;

  /** Undo the most recent entry. Returns the doc/selection to restore, or null. */
  undo(): UndoResult | null;

  /** Redo the most recently undone entry. Returns the steps/selection to apply, or null. */
  redo(): RedoResult | null;

  /** Clear all history. */
  clear(): void;
}

export interface UndoResult {
  readonly doc: BlockNode;
  readonly selection: MultiSelection;
}

export interface RedoResult {
  readonly steps: readonly Step[];
  readonly selection: MultiSelection;
}
