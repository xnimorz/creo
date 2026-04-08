/**
 * Extension system types.
 *
 * Extensions add custom node types, marks, commands, keybindings,
 * input rules, and node views to the editor.
 */

import type { NodeSpec, MarkSpec, Schema } from "../model/schema";
import type { KeyBinding, CommandFn } from "../input/keymap";
import type { InputRule } from "../input/input-rules";
import type { EditorNode, BlockNode } from "../model/types";

// ── Extension interface ────────────────────────────────────────────────

export interface Extension {
  /** Unique name for this extension. */
  readonly name: string;

  /** Additional node types to add to the schema. */
  readonly nodes?: Readonly<Record<string, NodeSpec>>;

  /** Additional mark types to add to the schema. */
  readonly marks?: Readonly<Record<string, MarkSpec>>;

  /** Additional key bindings. */
  readonly keymap?: readonly KeyBinding[];

  /** Additional commands. */
  readonly commands?: Readonly<Record<string, CommandFn>>;

  /** Input rules for auto-formatting. */
  readonly inputRules?: readonly InputRule[];

  /** Custom node views for WYSIWYG rendering. */
  readonly nodeViews?: Readonly<Record<string, NodeViewFactory>>;

  /** Toolbar items to add. */
  readonly toolbarItems?: readonly ToolbarItem[];
}

// ── Node view factory ──────────────────────────────────────────────────

export interface NodeViewProps {
  /** The node being rendered. */
  readonly node: EditorNode;
  /** Get the absolute position of this node. */
  readonly getPos: () => number;
  /** Whether the node is selected. */
  readonly selected: boolean;
}

/**
 * Factory function that creates a DOM element to render a custom node.
 * Called once when the node is first rendered. The returned element is
 * inserted into the contenteditable surface.
 */
export type NodeViewFactory = (props: NodeViewProps) => NodeViewHandle;

export interface NodeViewHandle {
  /** The DOM element to render. */
  readonly dom: HTMLElement;

  /** Update the view when the node changes. Return false to force re-create. */
  update?(node: EditorNode): boolean;

  /** Called when the node view is removed. */
  destroy?(): void;

  /**
   * If true, this node view manages its own content (the editor won't
   * render children). Use for code blocks, atomic blocks, etc.
   */
  readonly contentDOM?: HTMLElement | null;
}

// ── Toolbar item ───────────────────────────────────────────────────────

export interface ToolbarItem {
  /** Unique identifier for this toolbar item. */
  readonly id: string;

  /** Display label. */
  readonly label: string;

  /** Icon text (short, e.g., "T" for table). */
  readonly icon?: string;

  /** Command to execute when clicked. */
  readonly command: CommandFn;

  /** Whether the item is currently active (e.g., bold is active when cursor is in bold text). */
  readonly isActive?: (state: import("../state/editor-state").EditorState) => boolean;

  /** Whether the item is currently enabled. */
  readonly isEnabled?: (state: import("../state/editor-state").EditorState) => boolean;

  /** Group name for toolbar grouping. */
  readonly group?: string;
}
