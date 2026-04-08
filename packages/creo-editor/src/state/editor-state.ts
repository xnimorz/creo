import type { BlockNode, Pos, Slice, EditorNode } from "../model/types";
import { createPos } from "../model/types";
import type { Schema } from "../model/schema";
import type { MultiSelection } from "./selection";
import { singleSelection, mapMultiSelection } from "./selection";

// ── Step types ─────────────────────────────────────────────────────────

export interface ReplaceStep {
  readonly type: "replace";
  /** Start of the range to replace. */
  readonly from: Pos;
  /** End of the range to replace. */
  readonly to: Pos;
  /** Content to insert. */
  readonly slice: Slice;
}

export interface AddMarkStep {
  readonly type: "addMark";
  readonly from: Pos;
  readonly to: Pos;
  readonly mark: { readonly type: string; readonly attrs: Readonly<Record<string, unknown>> };
}

export interface RemoveMarkStep {
  readonly type: "removeMark";
  readonly from: Pos;
  readonly to: Pos;
  readonly markType: string;
}

export interface SetNodeAttrStep {
  readonly type: "setNodeAttr";
  readonly pos: Pos;
  readonly attr: string;
  readonly value: unknown;
  readonly oldValue: unknown;
}

export type Step = ReplaceStep | AddMarkStep | RemoveMarkStep | SetNodeAttrStep;

// ── Step constructors ──────────────────────────────────────────────────

export function replaceStep(from: Pos | number, to: Pos | number, slice: Slice): ReplaceStep {
  return {
    type: "replace",
    from: typeof from === "number" ? createPos(from) : from,
    to: typeof to === "number" ? createPos(to) : to,
    slice,
  };
}

export function addMarkStep(
  from: Pos | number,
  to: Pos | number,
  mark: { type: string; attrs: Record<string, unknown> },
): AddMarkStep {
  return {
    type: "addMark",
    from: typeof from === "number" ? createPos(from) : from,
    to: typeof to === "number" ? createPos(to) : to,
    mark,
  };
}

export function removeMarkStep(
  from: Pos | number,
  to: Pos | number,
  markType: string,
): RemoveMarkStep {
  return {
    type: "removeMark",
    from: typeof from === "number" ? createPos(from) : from,
    to: typeof to === "number" ? createPos(to) : to,
    markType,
  };
}

export function setNodeAttrStep(
  pos: Pos | number,
  attr: string,
  value: unknown,
  oldValue: unknown,
): SetNodeAttrStep {
  return {
    type: "setNodeAttr",
    pos: typeof pos === "number" ? createPos(pos) : pos,
    attr,
    value,
    oldValue,
  };
}

// ── Step inversion ─────────────────────────────────────────────────────

/**
 * Invert a step to produce the undo step.
 * Requires the document state before the step was applied.
 */
export function invertStep(step: Step, _docBefore: BlockNode): Step {
  switch (step.type) {
    case "replace":
      // To undo a replace(from, to, slice): replace(from, from + insertedSize, removedSlice)
      // For now, we need the content that was removed — which requires reading from docBefore
      // This is a simplified version that records the inverse during application
      return {
        type: "replace",
        from: step.from,
        to: step.to, // Will be adjusted during actual application
        slice: step.slice, // Will be swapped with removed content
      };

    case "addMark":
      return {
        type: "removeMark",
        from: step.from,
        to: step.to,
        markType: step.mark.type,
      };

    case "removeMark":
      // To properly invert, we'd need the original mark attrs
      // For now, return a no-op placeholder
      return {
        type: "addMark",
        from: step.from,
        to: step.to,
        mark: { type: step.markType, attrs: {} },
      };

    case "setNodeAttr":
      return {
        type: "setNodeAttr",
        pos: step.pos,
        attr: step.attr,
        value: step.oldValue,
        oldValue: step.value,
      };
  }
}

// ── Transaction ────────────────────────────────────────────────────────

export interface Transaction {
  readonly steps: readonly Step[];
  readonly selection: MultiSelection;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly time: number;
}

export function createTransaction(
  selection: MultiSelection,
  steps: readonly Step[] = [],
  metadata: ReadonlyMap<string, unknown> = new Map(),
): Transaction {
  return {
    steps,
    selection,
    metadata,
    time: Date.now(),
  };
}

// ── Editor State ───────────────────────────────────────────────────────

export interface EditorState {
  readonly doc: BlockNode;
  readonly selection: MultiSelection;
  readonly schema: Schema;
}

export function createEditorState(
  doc: BlockNode,
  schema: Schema,
  selection?: MultiSelection,
): EditorState {
  return {
    doc,
    schema,
    selection: selection ?? singleSelection(0),
  };
}
