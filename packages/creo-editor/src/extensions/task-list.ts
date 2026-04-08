/**
 * Task List Extension
 *
 * Adds task_list and task_item node types for GFM-style task lists:
 *   - [ ] unchecked
 *   - [x] checked
 */

import type { Extension } from "./types";
import type { EditorState, Step } from "../state/editor-state";
import { setNodeAttrStep } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";
import { selFrom, createMultiSelection, createSelection } from "../state/selection";
import { createBlockNode, createTextNode, createPos, isBlockNode } from "../model/types";
import { resolvePos } from "../model/position";
import type { InputRule } from "../input/input-rules";

type Dispatch = (steps: readonly Step[], sel: MultiSelection) => void;

// ── Commands ───────────────────────────────────────────────────────────

function toggleTaskCheck(state: EditorState, dispatch?: Dispatch): boolean {
  const range = state.selection.ranges[state.selection.primary]!;
  const pos = selFrom(range) as number;

  try {
    const resolved = resolvePos(state.doc, createPos(pos));
    for (const entry of resolved.path) {
      if (entry.node.type === "task_item") {
        const checked = (entry.node.attrs as Record<string, unknown>)["checked"] as boolean;
        if (!dispatch) return true;
        const step = setNodeAttrStep(entry.offset + 1, "checked", !checked, checked);
        dispatch([step], state.selection);
        return true;
      }
    }
  } catch {
    // Not in a task item
  }

  return false;
}

// ── Input rule ─────────────────────────────────────────────────────────

function taskListInputRule(): InputRule {
  return {
    match: /^- \[([ x])\]\s$/,
    handler(_state, match, from, to, dispatch) {
      const _checked = match[1] === "x";
      // Delete the "- [ ] " text — full conversion to task list
      // would require block type change
      const step = { type: "replace" as const, from: createPos(from), to: createPos(to), slice: { content: [], openStart: 0, openEnd: 0 } };
      dispatch([step], createMultiSelection([createSelection(from)]));
      return true;
    },
  };
}

// ── Extension definition ───────────────────────────────────────────────

export function taskListExtension(): Extension {
  return {
    name: "task-list",

    nodes: {
      task_list: {
        content: "task_item+",
        group: "block",
      },
      task_item: {
        content: "block+",
        attrs: {
          checked: { default: false },
        },
      },
    },

    commands: {
      toggleTaskCheck,
    },

    inputRules: [taskListInputRule()],

    keymap: [
      {
        key: "Mod-Shift-x",
        command: toggleTaskCheck,
      },
    ],

    toolbarItems: [
      {
        id: "task-list",
        label: "Task List",
        icon: "☑",
        command: toggleTaskCheck,
        group: "lists",
      },
    ],
  };
}
