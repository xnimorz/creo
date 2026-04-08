/**
 * Input Rules — auto-formatting triggered by typing patterns.
 *
 * When the user types a pattern (like "# " at the start of a line),
 * the input rule transforms the content (e.g., converts paragraph to heading).
 */

import type { EditorState, Step } from "../state/editor-state";
import { replaceStep } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";
import { selFrom, createMultiSelection, createSelection } from "../state/selection";
import { resolvePos } from "../model/position";
import { createBlockNode, createTextNode, createSlice, emptySlice, isBlockNode, isTextNode, createPos, nodeSize } from "../model/types";
import type { BlockNode, Pos } from "../model/types";

export type Dispatch = (steps: readonly Step[], selection: MultiSelection) => void;

export interface InputRule {
  /** Pattern to match against text before the cursor. */
  readonly match: RegExp;
  /** Handler called when the pattern matches. Return true if handled. */
  readonly handler: (
    state: EditorState,
    match: RegExpMatchArray,
    from: number,
    to: number,
    dispatch: Dispatch,
  ) => boolean;
}

// ── Rule checking ──────────────────────────────────────────────────────

/**
 * Check all input rules after text is inserted.
 * Call this after each insertText to see if a rule triggers.
 */
export function checkInputRules(
  rules: readonly InputRule[],
  state: EditorState,
  dispatch: Dispatch,
): boolean {
  const range = state.selection.ranges[state.selection.primary];
  if (!range) return false;

  const cursorPos = selFrom(range) as number;

  // Get the text before the cursor in the current block
  const textBefore = getTextBeforeCursor(state.doc, cursorPos);
  if (!textBefore) return false;

  for (const rule of rules) {
    const match = rule.match.exec(textBefore.text);
    if (match) {
      const matchFrom = textBefore.blockContentStart + match.index!;
      const matchTo = matchFrom + match[0].length;
      if (rule.handler(state, match, matchFrom, matchTo, dispatch)) {
        return true;
      }
    }
  }

  return false;
}

function getTextBeforeCursor(doc: BlockNode, cursorPos: number): { text: string; blockContentStart: number } | null {
  try {
    const resolved = resolvePos(doc, createPos(cursorPos));
    const parent = resolved.parent;

    if (parent.type !== "paragraph" && parent.type !== "heading") return null;

    // Find the absolute start of this block's content
    const parentEntry = resolved.path[resolved.path.length - 1];
    if (!parentEntry) return null;
    const blockContentStart = parentEntry.offset;

    // parentOffset tells us how far into the block content the cursor is.
    // Collect text up to parentOffset characters.
    const maxChars = resolved.parentOffset;
    let text = "";
    let consumed = 0;

    for (const child of parent.content) {
      if (consumed >= maxChars) break;

      if (isTextNode(child)) {
        const remaining = maxChars - consumed;
        if (child.text.length <= remaining) {
          text += child.text;
          consumed += child.text.length;
        } else {
          text += child.text.slice(0, remaining);
          consumed += remaining;
        }
      } else if (isBlockNode(child)) {
        // Skip block children for text extraction
        consumed += nodeSize(child) as number;
      }
    }

    return { text, blockContentStart };
  } catch {
    return null;
  }
}

// ── Built-in rules ─────────────────────────────────────────────────────

/**
 * Heading rule: "# " at start of line → H1, "## " → H2, etc.
 */
export function headingRule(): InputRule {
  return {
    match: /^(#{1,6})\s$/,
    handler(state, match, from, to, dispatch) {
      const level = match[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;

      // Delete the "# " text
      const deleteStep = replaceStep(from, to, emptySlice);

      // We need to change the parent paragraph to a heading
      // For now, we delete the trigger text; full block type change
      // requires a more sophisticated transform
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/**
 * Bullet list rule: "- " or "* " at start of line → unordered list.
 */
export function bulletListRule(): InputRule {
  return {
    match: /^[-*]\s$/,
    handler(_state, _match, from, to, dispatch) {
      const deleteStep = replaceStep(from, to, emptySlice);
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/**
 * Ordered list rule: "1. " at start of line → ordered list.
 */
export function orderedListRule(): InputRule {
  return {
    match: /^\d+\.\s$/,
    handler(_state, _match, from, to, dispatch) {
      const deleteStep = replaceStep(from, to, emptySlice);
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/**
 * Blockquote rule: "> " at start of line → blockquote.
 */
export function blockquoteRule(): InputRule {
  return {
    match: /^>\s$/,
    handler(_state, _match, from, to, dispatch) {
      const deleteStep = replaceStep(from, to, emptySlice);
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/**
 * Code block rule: "```" followed by Enter → code block.
 */
export function codeBlockRule(): InputRule {
  return {
    match: /^```(\w*)\s*$/,
    handler(_state, _match, from, to, dispatch) {
      const deleteStep = replaceStep(from, to, emptySlice);
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/**
 * Horizontal rule: "---" or "***" at start of line → hr.
 */
export function horizontalRuleRule(): InputRule {
  return {
    match: /^(---|\*\*\*|___)\s*$/,
    handler(_state, _match, from, to, dispatch) {
      const deleteStep = replaceStep(from, to, emptySlice);
      const newSel = createMultiSelection([createSelection(from)]);
      dispatch([deleteStep], newSel);
      return true;
    },
  };
}

/** All built-in input rules. */
export function defaultInputRules(): readonly InputRule[] {
  return [
    headingRule(),
    bulletListRule(),
    orderedListRule(),
    blockquoteRule(),
    codeBlockRule(),
    horizontalRuleRule(),
  ];
}
