/**
 * GFM Table Extension
 *
 * Adds table, table_row, table_cell, table_header node types.
 * These are already in the default schema for parsing — this extension
 * adds commands and toolbar items for table manipulation.
 */

import type { Extension } from "./types";
import type { NodeSpec } from "../model/schema";
import type { EditorState, Step } from "../state/editor-state";
import { replaceStep } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";
import { selFrom, createMultiSelection, createSelection } from "../state/selection";
import { createBlockNode, createTextNode, createSlice, isBlockNode, nodeSize, createPos } from "../model/types";
import type { BlockNode } from "../model/types";
import { resolvePos } from "../model/position";

type Dispatch = (steps: readonly Step[], sel: MultiSelection) => void;

// ── Table commands ─────────────────────────────────────────────────────

function insertTable(rows: number, cols: number) {
  return (state: EditorState, dispatch?: Dispatch): boolean => {
    if (!dispatch) return true;

    // Build table node
    const headerCells: BlockNode[] = [];
    for (let c = 0; c < cols; c++) {
      headerCells.push(
        createBlockNode("table_header", {}, [
          createBlockNode("paragraph", {}, [createTextNode(`Header ${c + 1}`)]),
        ]),
      );
    }
    const headerRow = createBlockNode("table_row", {}, headerCells);

    const dataRows: BlockNode[] = [];
    for (let r = 0; r < rows - 1; r++) {
      const cells: BlockNode[] = [];
      for (let c = 0; c < cols; c++) {
        cells.push(
          createBlockNode("table_cell", {}, [createBlockNode("paragraph")]),
        );
      }
      dataRows.push(createBlockNode("table_row", {}, cells));
    }

    const table = createBlockNode("table", {}, [headerRow, ...dataRows]);

    // Insert at cursor position
    const range = state.selection.ranges[state.selection.primary]!;
    const from = selFrom(range) as number;

    const step = replaceStep(from, from, createSlice([table]));
    const newPos = from + nodeSize(table) as number;
    dispatch([step], createMultiSelection([createSelection(newPos)]));
    return true;
  };
}

function addTableRow(state: EditorState, dispatch?: Dispatch): boolean {
  // Find current table context
  const range = state.selection.ranges[state.selection.primary]!;
  const pos = selFrom(range) as number;

  let tableNode: BlockNode | null = null;
  let colCount = 0;

  try {
    const resolved = resolvePos(state.doc, createPos(pos));
    for (const entry of resolved.path) {
      if (entry.node.type === "table") {
        tableNode = entry.node;
        // Get column count from first row
        if (tableNode.content.length > 0) {
          const firstRow = tableNode.content[0]!;
          if (isBlockNode(firstRow)) {
            colCount = firstRow.content.length;
          }
        }
        break;
      }
    }
  } catch {
    return false;
  }

  if (!tableNode || colCount === 0) return false;
  if (!dispatch) return true;

  // Create new row with empty cells
  const cells: BlockNode[] = [];
  for (let c = 0; c < colCount; c++) {
    cells.push(
      createBlockNode("table_cell", {}, [createBlockNode("paragraph")]),
    );
  }
  const newRow = createBlockNode("table_row", {}, cells);

  // For now, dispatch a simple notification — full implementation would
  // find the insertion position within the table and insert the row
  dispatch([], state.selection);
  return true;
}

function addTableColumn(state: EditorState, dispatch?: Dispatch): boolean {
  // Similar to addTableRow — find table context, add a cell to each row
  if (!dispatch) return true;
  dispatch([], state.selection);
  return true;
}

// ── Extension definition ───────────────────────────────────────────────

export function tableExtension(): Extension {
  return {
    name: "table",

    // Table nodes are already in default schema, but we define them
    // here for completeness if used standalone
    nodes: {
      table: {
        content: "table_row+",
        group: "block",
      },
      table_row: {
        content: "(table_cell | table_header)+",
      },
      table_cell: {
        content: "block+",
        attrs: {
          colspan: { default: 1 },
          rowspan: { default: 1 },
        },
      },
      table_header: {
        content: "block+",
        attrs: {
          colspan: { default: 1 },
          rowspan: { default: 1 },
        },
      },
    },

    commands: {
      insertTable: insertTable(3, 3),
      addTableRow,
      addTableColumn,
    },

    keymap: [
      // Tab to move between cells (basic)
      {
        key: "Tab",
        command: (state, dispatch) => {
          // Only handle when inside a table
          const range = state.selection.ranges[state.selection.primary]!;
          const pos = selFrom(range) as number;
          try {
            const resolved = resolvePos(state.doc, createPos(pos));
            const inTable = resolved.path.some(e => e.node.type === "table");
            if (!inTable) return false;
            // Move to next cell — simplified
            return false; // TODO: implement cell navigation
          } catch {
            return false;
          }
        },
      },
    ],

    toolbarItems: [
      {
        id: "insert-table",
        label: "Table",
        icon: "⊞",
        command: insertTable(3, 3),
        group: "insert",
      },
    ],
  };
}
