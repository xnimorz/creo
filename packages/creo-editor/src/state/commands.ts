/**
 * Built-in editor commands.
 *
 * Each command takes (state, dispatch?) and returns boolean.
 * If dispatch is absent, the command checks if it CAN be applied.
 * If dispatch is present, the command applies and dispatches.
 */

import type { EditorState, Step } from "./editor-state";
import { replaceStep, addMarkStep, removeMarkStep, setNodeAttrStep, createEditorState } from "./editor-state";
import type { MultiSelection } from "./selection";
import { createSelection, createMultiSelection, singleSelection, selFrom, selTo, selIsEmpty } from "./selection";
import { createTextNode, createBlockNode, createSlice, emptySlice, isBlockNode, isTextNode, nodeSize, createPos } from "../model/types";
import type { Pos, Mark, BlockNode, EditorNode } from "../model/types";
import { resolvePos } from "../model/position";

type Dispatch = (steps: readonly Step[], selection: MultiSelection) => void;

// ── Text insertion ─────────────────────────────────────────────────────

export function insertText(
  text: string,
): (state: EditorState, dispatch?: Dispatch) => boolean {
  return (state, dispatch) => {
    if (!dispatch) return true;

    const steps: Step[] = [];
    const newRanges: { anchor: number; head: number }[] = [];

    // Apply in reverse order to preserve positions
    const ranges = [...state.selection.ranges].sort(
      (a, b) => (selFrom(b) as number) - (selFrom(a) as number),
    );

    let offset = 0;
    for (const range of ranges) {
      const from = selFrom(range) as number;
      const to = selTo(range) as number;

      // Inherit marks from the text at the insertion point
      const marks = marksAtPos(state.doc, from);
      const insertNode = createTextNode(text, marks);

      steps.push(replaceStep(from, to, createSlice([insertNode])));

      const newPos = from + text.length;
      newRanges.push({ anchor: newPos + offset, head: newPos + offset });

      // Calculate offset change for next iteration
      offset += text.length - (to - from);
    }

    // Reverse the ranges back to forward order
    newRanges.reverse();
    const selection = createMultiSelection(
      newRanges.map(r => createSelection(r.anchor, r.head)),
      state.selection.primary,
    );

    dispatch(steps, selection);
    return true;
  };
}

/**
 * Get the marks active at a given position.
 * Looks at the text node before or at the position.
 */
function marksAtPos(doc: BlockNode, pos: number): readonly Mark[] {
  try {
    const resolved = resolvePos(doc, createPos(pos));
    const parent = resolved.parent;

    // Walk through the parent's content to find the text node at this offset
    let offset = 0;
    for (const child of parent.content) {
      if (isTextNode(child)) {
        const childEnd = offset + child.text.length;
        // If pos falls within or right at the end of this text node, use its marks
        if (offset < resolved.parentOffset && resolved.parentOffset <= childEnd) {
          return child.marks;
        }
        // If pos is right at the start of this text node and it's the first one, use its marks
        if (offset === resolved.parentOffset && resolved.parentOffset === 0) {
          return child.marks;
        }
        offset = childEnd;
      } else if (isBlockNode(child)) {
        offset += nodeSize(child) as number;
      }
    }

    // If we're past all text, check the last text node (typing at end inherits marks)
    for (let i = parent.content.length - 1; i >= 0; i--) {
      const child = parent.content[i]!;
      if (isTextNode(child)) {
        return child.marks;
      }
    }
  } catch {
    // Position resolution failed
  }
  return [];
}

// ── Delete backward (Backspace) ────────────────────────────────────────

export function deleteBackward(state: EditorState, dispatch?: Dispatch): boolean {
  if (!dispatch) return true;

  const steps: Step[] = [];
  const newRanges: { anchor: number; head: number }[] = [];
  const docContentSize = nodeSize(state.doc) as number;

  const ranges = [...state.selection.ranges].sort(
    (a, b) => (selFrom(b) as number) - (selFrom(a) as number),
  );

  let offset = 0;
  for (const range of ranges) {
    let from = selFrom(range) as number;
    let to = selTo(range) as number;

    // Clamp to valid content range (can't delete block boundaries at doc edges)
    from = Math.max(0, from);
    to = Math.min(docContentSize, to);

    if (from !== to) {
      // Selection range — delete the selection
      steps.push(replaceStep(from, to, emptySlice));
      newRanges.push({ anchor: from + offset, head: from + offset });
      offset -= (to - from);
    } else if (from > 0) {
      // Cursor — delete one character backward
      const deleteFrom = from - 1;
      steps.push(replaceStep(deleteFrom, from, emptySlice));
      newRanges.push({ anchor: deleteFrom + offset, head: deleteFrom + offset });
      offset -= 1;
    }
  }

  newRanges.reverse();
  if (newRanges.length === 0) return false;

  // Clamp cursor position to >= 1 (inside at least the empty paragraph)
  const selection = createMultiSelection(
    newRanges.map(r => createSelection(Math.max(1, r.anchor), Math.max(1, r.head))),
  );

  dispatch(steps, selection);
  return true;
}

// ── Delete forward (Delete key) ────────────────────────────────────────

export function deleteForward(state: EditorState, dispatch?: Dispatch): boolean {
  if (!dispatch) return true;

  const steps: Step[] = [];
  const newRanges: { anchor: number; head: number }[] = [];
  const docSize = nodeSize(state.doc) as number;

  const ranges = [...state.selection.ranges].sort(
    (a, b) => (selFrom(b) as number) - (selFrom(a) as number),
  );

  let offset = 0;
  for (const range of ranges) {
    const from = selFrom(range) as number;
    const to = selTo(range) as number;

    if (from !== to) {
      steps.push(replaceStep(from, to, emptySlice));
      newRanges.push({ anchor: from + offset, head: from + offset });
      offset -= (to - from);
    } else if (to < docSize - 1) {
      steps.push(replaceStep(from, from + 1, emptySlice));
      newRanges.push({ anchor: from + offset, head: from + offset });
      offset -= 1;
    }
  }

  newRanges.reverse();
  if (newRanges.length === 0) return false;

  const selection = createMultiSelection(
    newRanges.map(r => createSelection(r.anchor, r.head)),
  );

  dispatch(steps, selection);
  return true;
}

// ── Mark toggling ──────────────────────────────────────────────────────

export function toggleMark(
  markType: string,
  attrs: Record<string, unknown> = {},
): (state: EditorState, dispatch?: Dispatch) => boolean {
  return (state, dispatch) => {
    const { ranges } = state.selection;

    // Check if any range has the mark already
    const hasMarkInAnyRange = ranges.some(range => {
      const from = selFrom(range) as number;
      const to = selTo(range) as number;
      return rangeHasMark(state.doc, from, to, markType);
    });

    if (!dispatch) return true;

    const steps: Step[] = [];

    for (const range of ranges) {
      const from = selFrom(range) as number;
      const to = selTo(range) as number;

      if (from === to) continue; // Can't toggle mark on cursor

      if (hasMarkInAnyRange) {
        steps.push(removeMarkStep(from, to, markType));
      } else {
        steps.push(addMarkStep(from, to, { type: markType, attrs }));
      }
    }

    dispatch(steps, state.selection);
    return true;
  };
}

function rangeHasMark(doc: BlockNode, from: number, to: number, markType: string): boolean {
  let found = false;
  walkTextInRange(doc, from, to, 1, (text) => {
    if (text.marks.some(m => m.type === markType)) {
      found = true;
    }
  });
  return found;
}

function walkTextInRange(
  node: BlockNode,
  from: number,
  to: number,
  offset: number,
  cb: (text: import("../model/types").TextNode) => void,
): void {
  let pos = offset;
  for (const child of node.content) {
    const size = nodeSize(child) as number;
    const end = pos + size;

    if (end > from && pos < to) {
      if (isTextNode(child)) {
        cb(child);
      } else if (isBlockNode(child) && !child.atom) {
        walkTextInRange(child, from, to, pos + 1, cb);
      }
    }

    pos = end;
  }
}

// ── Heading command ────────────────────────────────────────────────────

export function setHeading(
  level: 1 | 2 | 3 | 4 | 5 | 6,
): (state: EditorState, dispatch?: Dispatch) => boolean {
  return (state, dispatch) => {
    if (!dispatch) return true;

    const steps: Step[] = [];
    const range = state.selection.ranges[state.selection.primary]!;
    const from = selFrom(range) as number;

    // Find the block node containing the cursor
    const resolved = resolvePos(state.doc, createPos(from));
    const parent = resolved.parent;

    if (parent.type === "paragraph" || parent.type === "heading") {
      // Find position of the parent block
      // For simplicity, use setNodeAttr to change type
      // This requires knowing the parent's position in the document
      // Since setNodeAttr only changes attrs, we need a different approach
      // for changing node type. For now, we'll use it for heading level changes.
      if (parent.type === "heading") {
        // Find position to set attr
        for (const entry of resolved.path) {
          if (entry.node.type === "heading") {
            // We need the position of this node
            steps.push(setNodeAttrStep(
              entry.offset + 1, // position inside the heading
              "level",
              level,
              (entry.node.attrs as Record<string, unknown>)["level"],
            ));
            break;
          }
        }
      }
    }

    dispatch(steps, state.selection);
    return true;
  };
}

// ── Split block (Enter) ───────────────────────────────────────────────

/**
 * Split the block at the cursor into two blocks.
 * The current block keeps content before the cursor; a new paragraph
 * gets the content after the cursor.
 */
export function splitBlock(state: EditorState, dispatch?: Dispatch): boolean {
  if (!dispatch) return true;

  const range = state.selection.ranges[state.selection.primary];
  if (!range) return false;

  const from = selFrom(range) as number;
  const to = selTo(range) as number;

  let resolved;
  try {
    resolved = resolvePos(state.doc, createPos(from));
  } catch {
    return false;
  }

  const parent = resolved.parent;
  const parentOffset = resolved.parentOffset;

  // Only split blocks with inline content
  const inlineTypes = new Set(["paragraph", "heading"]);
  if (!inlineTypes.has(parent.type)) {
    return false;
  }

  // Split the inline content at the cursor position
  const contentBefore: EditorNode[] = [];
  const contentAfter: EditorNode[] = [];
  let charsSeen = 0;

  for (const child of parent.content) {
    if (isTextNode(child)) {
      const childEnd = charsSeen + child.text.length;

      if (childEnd <= parentOffset) {
        contentBefore.push(child);
      } else if (charsSeen >= parentOffset) {
        contentAfter.push(child);
      } else {
        const splitAt = parentOffset - charsSeen;
        if (splitAt > 0) {
          contentBefore.push(createTextNode(child.text.slice(0, splitAt), child.marks));
        }
        if (splitAt < child.text.length) {
          contentAfter.push(createTextNode(child.text.slice(splitAt), child.marks));
        }
      }
      charsSeen = childEnd;
    } else if (isBlockNode(child)) {
      const childSize = nodeSize(child) as number;
      if (charsSeen + childSize <= parentOffset) {
        contentBefore.push(child);
      } else {
        contentAfter.push(child);
      }
      charsSeen += childSize;
    }
  }

  // Build the two new blocks
  const blockBefore = createBlockNode(parent.type, parent.attrs, contentBefore, parent.marks, parent.atom);
  const blockAfter = createBlockNode("paragraph", {}, contentAfter);

  // Find parent in the path and replace it in the tree
  const path = resolved.path;
  if (path.length < 2) return false;

  const parentEntry = path[path.length - 1]!;
  const grandparent = path[path.length - 2]!;

  let parentIdx = -1;
  for (let i = 0; i < grandparent.node.content.length; i++) {
    if (grandparent.node.content[i] === parentEntry.node) {
      parentIdx = i;
      break;
    }
  }
  if (parentIdx < 0) return false;

  // Build new grandparent content
  const newContent = [...grandparent.node.content];
  newContent.splice(parentIdx, 1, blockBefore, blockAfter);

  const newGrandparent = createBlockNode(
    grandparent.node.type, grandparent.node.attrs,
    newContent, grandparent.node.marks, grandparent.node.atom,
  );

  // Rebuild the doc tree
  const newDoc = replaceNodeInTree(state.doc, grandparent.node, newGrandparent);
  if (!newDoc) return false;

  // New cursor: start of blockAfter's content
  // parentEntry.offset = position where we entered the old paragraph (includes its +1 open boundary)
  // blockBefore starts at parentEntry.offset - 1 (the boundary position)
  // blockAfter starts at (parentEntry.offset - 1) + nodeSize(blockBefore)
  // Cursor inside blockAfter = blockAfterStart + 1 (its open boundary)
  const blockBeforeSize = nodeSize(blockBefore) as number;
  const blockAfterStart = (parentEntry.offset - 1) + blockBeforeSize;
  const newCursorPos = blockAfterStart + 1;

  // Use replaceState through a special dispatch pattern
  // We encode this as a custom operation by passing the new state
  // The WYSIWYG surface's dispatch wraps editor.get().dispatch()
  // which won't apply steps correctly for tree restructuring.
  // Instead, signal via metadata that this is a state replacement.
  (dispatch as unknown as SplitDispatch).__splitBlock?.(newDoc, singleSelection(newCursorPos));

  // If __splitBlock is not available (unit tests), fall back to no-op
  return true;
}

/** Extended dispatch interface for splitBlock */
export interface SplitDispatch {
  __splitBlock?: (doc: BlockNode, sel: MultiSelection) => void;
}

/**
 * Replace a node in the tree by identity, returning the new root.
 */
function replaceNodeInTree(
  root: BlockNode,
  target: BlockNode,
  replacement: BlockNode,
): BlockNode | null {
  if (root === target) return replacement;

  let changed = false;
  const newContent: EditorNode[] = [];

  for (const child of root.content) {
    if (child === target) {
      newContent.push(replacement);
      changed = true;
    } else if (isBlockNode(child) && !child.atom) {
      const result = replaceNodeInTree(child, target, replacement);
      if (result) {
        newContent.push(result);
        changed = true;
      } else {
        newContent.push(child);
      }
    } else {
      newContent.push(child);
    }
  }

  if (!changed) return null;
  return createBlockNode(root.type, root.attrs, newContent, root.marks, root.atom);
}

// ── Convenience: pre-built toggle commands ─────────────────────────────

export const toggleBold = toggleMark("bold");
export const toggleItalic = toggleMark("italic");
export const toggleCode = toggleMark("code");
export const toggleStrikethrough = toggleMark("strikethrough");
