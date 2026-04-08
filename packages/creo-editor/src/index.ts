// creo-editor — Rich Text / Markdown Editor for Creo

// ── Model ──────────────────────────────────────────────────────────────

export type {
  EditorNode,
  BlockNode,
  TextNode,
  Mark,
  Pos,
  NodeSize,
  NodeType,
  MarkType,
  Slice,
  NodeAttrMap,
  MarkAttrMap,
} from "./model/types";

export {
  createPos,
  createBlockNode,
  createTextNode,
  createMark,
  nodeSize,
  contentSize,
  isBlockNode,
  isTextNode,
  nodesEqual,
  marksEqual,
  createSlice,
  emptySlice,
} from "./model/types";

export type { Schema, NodeSpec, MarkSpec } from "./model/schema";
export { createSchema, validateContent, validateDocument, isMarkAllowed, isAtomNode } from "./model/schema";
export { defaultSchema } from "./model/default-schema";

export type { ResolvedPos } from "./model/position";
export { resolvePos, posAtStartOf, posAtEndOf } from "./model/position";

// ── State ──────────────────────────────────────────────────────────────

export type {
  EditorState,
  Transaction,
  Step,
  ReplaceStep,
  AddMarkStep,
  RemoveMarkStep,
  SetNodeAttrStep,
} from "./state/editor-state";

export {
  createEditorState,
  createTransaction,
  replaceStep,
  addMarkStep,
  removeMarkStep,
  setNodeAttrStep,
  invertStep,
} from "./state/editor-state";

export type { Selection, MultiSelection } from "./state/selection";
export {
  createSelection,
  createMultiSelection,
  singleSelection,
  selFrom,
  selTo,
  selIsEmpty,
} from "./state/selection";

export type { StepResult, PosMapping } from "./state/transform";
export { applyStep, applyTransaction } from "./state/transform";

// ── Commands ───────────────────────────────────────────────────────────

export {
  insertText,
  deleteBackward,
  deleteForward,
  toggleMark,
  toggleBold,
  toggleItalic,
  toggleCode,
  toggleStrikethrough,
  setHeading,
  splitBlock,
} from "./state/commands";

// ── Markdown ───────────────────────────────────────────────────────────

export { parseMarkdown } from "./markdown/parse";
export { serializeMarkdown } from "./markdown/serialize";

// ── Input ──────────────────────────────────────────────────────────────

export type { KeyBinding, CommandFn, Keymap } from "./input/keymap";
export { createKeymap, parseKeyCombo } from "./input/keymap";
export { handleInputType } from "./input/input-handler";

export type { InputRule } from "./input/input-rules";
export {
  checkInputRules,
  headingRule,
  bulletListRule,
  orderedListRule,
  blockquoteRule,
  codeBlockRule,
  horizontalRuleRule,
  defaultInputRules,
} from "./input/input-rules";

export { pasteToSlice, extractPasteData } from "./input/paste";
export type { PasteData } from "./input/paste";

// ── Store ──────────────────────────────────────────────────────────────

export type { EditorInstance, EditorStoreConfig } from "./state/store";
export { createEditorStore } from "./state/store";

// ── Views ──────────────────────────────────────────────────────────────

export { CreoEditor } from "./views/editor";
export type { EditorProps } from "./views/editor";
export { Toolbar } from "./views/toolbar";
export { WysiwygSurface } from "./views/wysiwyg-surface";

// ── Mutation Controller ────────────────────────────────────────────────

export type { MutationController, MutationControllerConfig } from "./views/mutation-controller";
export { createMutationController } from "./views/mutation-controller";

// ── DOM Renderer ───────────────────────────────────────────────────────

export { renderToDOM, patchDOM, parseDOMToNode } from "./views/dom-renderer";

// ── Selection Sync ─────────────────────────────────────────────────────

export { domSelectionToModel, modelSelectionToDOM } from "./views/selection-sync";

// ── Standalone ─────────────────────────────────────────────────────────

export type { MountOptions, EditorHandle } from "./standalone/mount";
export { mountEditor } from "./standalone/mount";

// ── History ────────────────────────────────────────────────────────────

export type { History, HistoryState, HistoryEntry, HistoryConfig, UndoResult, RedoResult } from "./state/history";
export { createHistory } from "./state/history";

// ── Extensions ─────────────────────────────────────────────────────────

export type {
  Extension,
  NodeViewFactory,
  NodeViewProps,
  NodeViewHandle,
  ToolbarItem,
} from "./extensions/types";

export type { MergedExtensionConfig } from "./extensions/registry";
export { mergeExtensions } from "./extensions/registry";

export { tableExtension } from "./extensions/table";
export { taskListExtension } from "./extensions/task-list";
