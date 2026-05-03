import type { Store } from "creo";
import type { DocState, Selection } from "../model/types";

/**
 * Snapshot-based undo/redo. We don't synthesize inverse commands — we just
 * stash the previous (doc, sel) before each mutation and let undo restore
 * it.
 *
 * Coalescing rule: consecutive `insertText` / `deleteBackward` ops within
 * 500ms collapse into a single undo entry. This matches Notion / Google
 * Docs UX — typing a sentence then hitting Cmd+Z removes the whole sentence,
 * not the last character.
 */

export type HistoryEntry = {
  doc: DocState;
  sel: Selection;
  // Tag of the action that produced this entry — used to decide if the
  // *next* action coalesces with it.
  tag: string;
  ts: number;
};

export type HistoryStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export const COALESCE_MS = 500;
export const HISTORY_CAP = 200;

export function createHistory(stores: HistoryStores) {
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let pinned = false;

  /**
   * Record the CURRENT state with the given action tag. Call BEFORE
   * mutating. If the tag matches the previous entry and the time gap is
   * small, the previous entry is reused (no new undo step).
   */
  const record = (tag: string): void => {
    if (pinned) return;
    redoStack.length = 0; // any new edit invalidates the redo trail
    const top = undoStack[undoStack.length - 1];
    const now = Date.now();
    const coalesce =
      top != null &&
      top.tag === tag &&
      tag.startsWith("text:") &&
      now - top.ts < COALESCE_MS;
    if (coalesce) {
      // Don't push another entry — the existing one's snapshot pre-dates
      // the keystroke chain.
      top.ts = now;
      return;
    }
    undoStack.push({
      doc: stores.docStore.get(),
      sel: stores.selStore.get(),
      tag,
      ts: now,
    });
    if (undoStack.length > HISTORY_CAP) undoStack.shift();
  };

  const undo = (): boolean => {
    const entry = undoStack.pop();
    if (!entry) return false;
    pinned = true;
    redoStack.push({
      doc: stores.docStore.get(),
      sel: stores.selStore.get(),
      tag: entry.tag,
      ts: Date.now(),
    });
    stores.docStore.set(entry.doc);
    stores.selStore.set(entry.sel);
    pinned = false;
    return true;
  };

  const redo = (): boolean => {
    const entry = redoStack.pop();
    if (!entry) return false;
    pinned = true;
    undoStack.push({
      doc: stores.docStore.get(),
      sel: stores.selStore.get(),
      tag: entry.tag,
      ts: Date.now(),
    });
    stores.docStore.set(entry.doc);
    stores.selStore.set(entry.sel);
    pinned = false;
    return true;
  };

  /** Reset everything — used after a wholesale doc replacement. */
  const reset = (): void => {
    undoStack.length = 0;
    redoStack.length = 0;
  };

  return { record, undo, redo, reset };
}

export type History = ReturnType<typeof createHistory>;
