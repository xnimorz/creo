/**
 * Editor Store — wraps EditorState in a Creo Store for reactive UI.
 */

import { store } from "creo";
import type { Store } from "creo";
import type { EditorState, Step, Transaction } from "./editor-state";
import { createEditorState, createTransaction } from "./editor-state";
import type { MultiSelection } from "./selection";
import { singleSelection } from "./selection";
import { applyTransaction } from "./transform";
import { createBlockNode } from "../model/types";
import { defaultSchema } from "../model/default-schema";
import { parseMarkdown } from "../markdown/parse";
import { serializeMarkdown } from "../markdown/serialize";
import type { Schema } from "../model/schema";
import type { KeyBinding } from "../input/keymap";
import { createKeymap } from "../input/keymap";
import type { Keymap } from "../input/keymap";
import {
  toggleBold,
  toggleItalic,
  toggleCode,
  toggleStrikethrough,
  deleteBackward,
  deleteForward,
  splitBlock,
} from "./commands";
import { createHistory } from "./history";
import type { History } from "./history";

// ── Editor instance ────────────────────────────────────────────────────

export interface EditorInstance {
  readonly state: EditorState;
  readonly keymap: Keymap;
  readonly history: History;

  /** Dispatch steps to produce a new editor state. */
  dispatch(steps: readonly Step[], selection: MultiSelection): void;

  /** Replace the entire editor state (for complex operations like block splitting). */
  replaceState(newDoc: import("../model/types").BlockNode, selection: MultiSelection): void;

  /** Undo the last action. Returns true if something was undone. */
  undo(): boolean;

  /** Redo the last undone action. Returns true if something was redone. */
  redo(): boolean;

  /** Get the current markdown content. */
  getContent(): string;

  /** Set the editor content from a markdown string. */
  setContent(markdown: string): void;
}

// ── Config ─────────────────────────────────────────────────────────────

export interface EditorStoreConfig {
  /** Initial content as markdown string. Default: empty. */
  readonly initialContent?: string;

  /** Schema to use. Default: defaultSchema. */
  readonly schema?: Schema;

  /** Additional key bindings (merged with defaults). */
  readonly keybindings?: readonly KeyBinding[];

  /** Called on every state change. */
  readonly onChange?: (markdown: string) => void;

  /** History configuration. */
  readonly history?: {
    /** Max undo entries. Default: 200. */
    readonly maxEntries?: number;
    /** Grouping delay in ms. Default: 500. */
    readonly groupingDelay?: number;
  };
}

// ── Create editor store ────────────────────────────────────────────────

export function createEditorStore(config: EditorStoreConfig = {}): Store<EditorInstance> {
  const schema = config.schema ?? defaultSchema;
  const initialDoc = config.initialContent
    ? parseMarkdown(config.initialContent)
    : parseMarkdown("");

  const initialState = createEditorState(initialDoc, schema, singleSelection(1));
  const history = createHistory(config.history);

  // Undo/redo commands (need closure over editorStore)
  const undoCommand: import("../input/keymap").CommandFn = (_state, dispatch) => {
    if (!dispatch) return history.canUndo;
    return editorStore.get().undo();
  };

  const redoCommand: import("../input/keymap").CommandFn = (_state, dispatch) => {
    if (!dispatch) return history.canRedo;
    return editorStore.get().redo();
  };

  const defaultBindings: KeyBinding[] = [
    { key: "Mod-b", command: toggleBold },
    { key: "Mod-i", command: toggleItalic },
    { key: "Mod-`", command: toggleCode },
    { key: "Mod-Shift-s", command: toggleStrikethrough },
    { key: "Mod-z", command: undoCommand },
    { key: "Mod-Shift-z", command: redoCommand },
    { key: "Backspace", command: deleteBackward },
    { key: "Delete", command: deleteForward },
    { key: "Enter", command: splitBlock },
  ];

  const allBindings = [
    ...defaultBindings,
    ...(config.keybindings ?? []),
  ];
  const keymap = createKeymap(allBindings);

  const editorStore: Store<EditorInstance> = store.new<EditorInstance>({
    state: initialState,
    keymap,
    history,

    dispatch(steps: readonly Step[], selection: MultiSelection) {
      const current = editorStore.get();
      const docBefore = current.state.doc;
      const selBefore = current.state.selection;
      let newState = applyTransaction(current.state, steps, selection);

      // Ensure doc always has at least one child (empty paragraph)
      if (newState.doc.content.length === 0) {
        const emptyParagraph = createBlockNode("paragraph");
        const fixedDoc = createBlockNode(
          newState.doc.type, newState.doc.attrs,
          [emptyParagraph], newState.doc.marks, newState.doc.atom,
        );
        newState = createEditorState(fixedDoc, newState.schema, singleSelection(1));
      }

      // Only record in history and notify if doc actually changed
      const docChanged = steps.length > 0;

      if (docChanged) {
        history.record(steps, selBefore, selection, docBefore);
      }

      editorStore.set({
        ...current,
        state: newState,
      });

      if (docChanged && config.onChange) {
        config.onChange(serializeMarkdown(newState.doc));
      }
    },

    replaceState(newDoc: import("../model/types").BlockNode, selection: MultiSelection) {
      const current = editorStore.get();
      const docBefore = current.state.doc;
      const selBefore = current.state.selection;

      let fixedDoc = newDoc;
      if (fixedDoc.content.length === 0) {
        fixedDoc = createBlockNode(
          fixedDoc.type, fixedDoc.attrs,
          [createBlockNode("paragraph")], fixedDoc.marks, fixedDoc.atom,
        );
        selection = singleSelection(1);
      }

      const newState = createEditorState(fixedDoc, current.state.schema, selection);

      // Record in history (as a "replace all" operation)
      history.record([], selBefore, selection, docBefore);

      editorStore.set({
        ...current,
        state: newState,
      });

      if (config.onChange) {
        config.onChange(serializeMarkdown(newState.doc));
      }
    },

    undo(): boolean {
      const result = history.undo();
      if (!result) return false;

      const current = editorStore.get();
      const newState = createEditorState(result.doc, current.state.schema, result.selection);

      editorStore.set({
        ...current,
        state: newState,
      });

      if (config.onChange) {
        config.onChange(serializeMarkdown(newState.doc));
      }

      return true;
    },

    redo(): boolean {
      const result = history.redo();
      if (!result) return false;

      const current = editorStore.get();
      const newState = applyTransaction(current.state, result.steps, result.selection);

      editorStore.set({
        ...current,
        state: newState,
      });

      if (config.onChange) {
        config.onChange(serializeMarkdown(newState.doc));
      }

      return true;
    },

    getContent() {
      return serializeMarkdown(editorStore.get().state.doc);
    },

    setContent(markdown: string) {
      const current = editorStore.get();
      const newDoc = parseMarkdown(markdown);
      const newState = createEditorState(newDoc, current.state.schema, singleSelection(1));
      history.clear(); // Content replacement clears history
      editorStore.set({
        ...current,
        state: newState,
      });
    },
  });

  return editorStore;
}
