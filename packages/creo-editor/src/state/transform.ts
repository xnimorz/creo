import type { BlockNode, EditorNode, TextNode, Pos, Mark, Slice } from "../model/types";
import {
  createBlockNode,
  createTextNode,
  isBlockNode,
  isTextNode,
  nodeSize,
  createPos,
  emptySlice,
  marksEqual,
} from "../model/types";
import type { Step, ReplaceStep, AddMarkStep, RemoveMarkStep, SetNodeAttrStep } from "./editor-state";
import type { EditorState } from "./editor-state";
import { createEditorState } from "./editor-state";
import type { MultiSelection } from "./selection";

// ── Apply a single step ────────────────────────────────────────────────

export interface StepResult {
  readonly doc: BlockNode;
  /** Maps old positions to new positions (accounts for inserted/deleted content). */
  readonly mapping: PosMapping;
}

export interface PosMapping {
  readonly map: (pos: Pos) => Pos;
}

export function applyStep(doc: BlockNode, step: Step): StepResult {
  switch (step.type) {
    case "replace":
      return applyReplace(doc, step);
    case "addMark":
      return applyAddMark(doc, step);
    case "removeMark":
      return applyRemoveMark(doc, step);
    case "setNodeAttr":
      return applySetNodeAttr(doc, step);
  }
}

// ── Apply a transaction (multiple steps) ───────────────────────────────

export function applyTransaction(
  state: EditorState,
  steps: readonly Step[],
  newSelection: MultiSelection,
): EditorState {
  let doc = state.doc;

  for (const step of steps) {
    const result = applyStep(doc, step);
    doc = result.doc;
  }

  return createEditorState(doc, state.schema, newSelection);
}

// ── Replace step implementation ────────────────────────────────────────

function applyReplace(doc: BlockNode, step: ReplaceStep): StepResult {
  const from = step.from as number;
  const to = step.to as number;
  const slice = step.slice;

  const newDoc = replaceRange(doc, from, to, slice, 0);

  // Calculate size difference for position mapping
  const oldSize = to - from;
  let newSize = 0;
  for (const node of slice.content) {
    newSize += nodeSize(node) as number;
  }
  const sizeDiff = newSize - oldSize;

  const mapping: PosMapping = {
    map(pos: Pos): Pos {
      const p = pos as number;
      if (p <= from) return pos;
      if (p >= to) return createPos(p + sizeDiff);
      // Position was in the deleted range — map to end of insertion
      return createPos(from + newSize);
    },
  };

  return { doc: newDoc, mapping };
}

/**
 * Replace content in a block node between two positions.
 * Positions are relative to the document root.
 */
function replaceRange(
  node: BlockNode,
  from: number,
  to: number,
  slice: Slice,
  baseOffset: number,
): BlockNode {
  // Content offset: baseOffset is the position of this block's opening boundary.
  // Children start at baseOffset (position 0 = first child of doc, since doc's
  // opening boundary is implicit in the position space).
  const newContent: EditorNode[] = [];
  let offset = baseOffset;

  for (let i = 0; i < node.content.length; i++) {
    const child = node.content[i]!;
    const childSize = nodeSize(child) as number;
    const childEnd = offset + childSize;

    if (childEnd <= from) {
      // Child is entirely before the range — keep as-is
      newContent.push(child);
    } else if (offset > to) {
      // Child is entirely after the range — keep as-is
      // Note: strict > (not >=) because when offset === to, the child
      // may still need to receive an insertion at its start boundary.
      newContent.push(child);
    } else if (offset >= from && childEnd <= to) {
      // Child is entirely within the range — skip it (will be replaced)
      // When we hit the first fully-contained child at `from`, insert the slice
      if (offset === from || (newContent.length === i && offset <= from)) {
        // Insert slice content here
        for (const sliceNode of slice.content) {
          newContent.push(sliceNode);
        }
      }
    } else if (isBlockNode(child) && !child.atom) {
      // Child partially overlaps — recurse into it
      // offset + 1: skip this child's opening boundary
      const result = replaceRange(child, from, to, slice, offset + 1);
      newContent.push(result);
    } else if (isTextNode(child)) {
      // Text node partially overlaps — split it
      const textStart = offset;
      const textEnd = offset + childSize;
      const parts: EditorNode[] = [];

      if (textStart < from) {
        // Keep text before `from`
        const keepLen = from - textStart;
        if (keepLen > 0) {
          parts.push(createTextNode(child.text.slice(0, keepLen), child.marks));
        }
      }

      // Insert slice content at the split point
      if (textStart <= from) {
        for (const sliceNode of slice.content) {
          parts.push(sliceNode);
        }
      }

      if (textEnd > to) {
        // Keep text after `to`
        const skipLen = to - textStart;
        if (skipLen < child.text.length) {
          parts.push(createTextNode(child.text.slice(skipLen), child.marks));
        }
      }

      newContent.push(...parts);
    } else {
      // Atom node partially overlapping — replace it
      if (offset <= from) {
        for (const sliceNode of slice.content) {
          newContent.push(sliceNode);
        }
      }
    }

    offset = childEnd;
  }

  // Handle insertion at the end of content
  if (from >= offset && slice.content.length > 0) {
    for (const sliceNode of slice.content) {
      newContent.push(sliceNode);
    }
  }

  // Filter out empty text nodes and merge adjacent text nodes with same marks
  const filtered = newContent.filter(n => !(isTextNode(n) && n.text.length === 0));
  const merged = mergeAdjacentText(filtered);

  return createBlockNode(node.type, node.attrs, merged, node.marks, node.atom);
}

// ── AddMark step implementation ────────────────────────────────────────

function applyAddMark(doc: BlockNode, step: AddMarkStep): StepResult {
  const from = step.from as number;
  const to = step.to as number;
  const mark = step.mark as Mark;

  const newDoc = mapTextInRange(doc, from, to, 0, (textNode) => {
    // Add mark if not already present
    if (textNode.marks.some(m => m.type === mark.type)) {
      return textNode;
    }
    return createTextNode(textNode.text, [...textNode.marks, mark]);
  });

  return { doc: newDoc, mapping: identityMapping };
}

// ── RemoveMark step implementation ─────────────────────────────────────

function applyRemoveMark(doc: BlockNode, step: RemoveMarkStep): StepResult {
  const from = step.from as number;
  const to = step.to as number;

  const newDoc = mapTextInRange(doc, from, to, 0, (textNode) => {
    const filtered = textNode.marks.filter(m => m.type !== step.markType);
    if (filtered.length === textNode.marks.length) return textNode;
    return createTextNode(textNode.text, filtered);
  });

  return { doc: newDoc, mapping: identityMapping };
}

// ── SetNodeAttr step implementation ────────────────────────────────────

function applySetNodeAttr(doc: BlockNode, step: SetNodeAttrStep): StepResult {
  const targetPos = step.pos as number;

  const newDoc = mapNodeAtPos(doc, targetPos, 0, (node) => {
    if (!isBlockNode(node)) return node;
    const newAttrs = { ...node.attrs, [step.attr]: step.value };
    return createBlockNode(node.type, newAttrs, node.content, node.marks, node.atom);
  });

  return { doc: newDoc, mapping: identityMapping };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Merge adjacent text nodes with identical marks into a single text node.
 */
function mergeAdjacentText(content: readonly EditorNode[]): EditorNode[] {
  if (content.length <= 1) return [...content];

  const result: EditorNode[] = [content[0]!];
  for (let i = 1; i < content.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = content[i]!;

    if (isTextNode(prev) && isTextNode(curr) && marksEqual(prev.marks, curr.marks)) {
      result[result.length - 1] = createTextNode(prev.text + curr.text, prev.marks);
    } else {
      result.push(curr);
    }
  }
  return result;
}

const identityMapping: PosMapping = {
  map(pos: Pos): Pos {
    return pos;
  },
};

/**
 * Map all text nodes within a position range, applying a transform function.
 */
function mapTextInRange(
  node: BlockNode,
  from: number,
  to: number,
  baseOffset: number,
  transform: (text: TextNode) => EditorNode,
): BlockNode {
  const innerStart = baseOffset;
  let offset = innerStart;
  let changed = false;
  const newContent: EditorNode[] = [];

  for (const child of node.content) {
    const childSize = nodeSize(child) as number;
    const childEnd = offset + childSize;

    if (childEnd <= from || offset >= to) {
      // Outside range — keep as-is
      newContent.push(child);
    } else if (isTextNode(child)) {
      const result = transform(child);
      if (result !== child) changed = true;
      newContent.push(result);
    } else if (isBlockNode(child) && !child.atom) {
      const result = mapTextInRange(child, from, to, offset + 1, transform);
      if (result !== child) changed = true;
      newContent.push(result);
    } else {
      newContent.push(child);
    }

    offset = childEnd;
  }

  if (!changed) return node;
  return createBlockNode(node.type, node.attrs, newContent, node.marks, node.atom);
}

/**
 * Find and transform a node at a specific position.
 */
function mapNodeAtPos(
  node: BlockNode,
  targetPos: number,
  baseOffset: number,
  transform: (node: EditorNode) => EditorNode,
): BlockNode {
  let offset = baseOffset;
  let changed = false;
  const newContent: EditorNode[] = [];

  for (const child of node.content) {
    const childSize = nodeSize(child) as number;

    if (offset === targetPos) {
      const result = transform(child);
      if (result !== child) changed = true;
      newContent.push(result);
    } else if (isBlockNode(child) && !child.atom && offset < targetPos && offset + childSize > targetPos) {
      const result = mapNodeAtPos(child, targetPos, offset + 1, transform);
      if (result !== child) changed = true;
      newContent.push(result);
    } else {
      newContent.push(child);
    }

    offset += childSize;
  }

  if (!changed) return node;
  return createBlockNode(node.type, node.attrs, newContent, node.marks, node.atom);
}
