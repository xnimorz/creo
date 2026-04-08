import { describe, test, expect } from "bun:test";
import {
  insertText,
  deleteBackward,
  deleteForward,
  toggleBold,
  toggleItalic,
} from "./commands";
import { createEditorState } from "./editor-state";
import type { Step } from "./editor-state";
import type { MultiSelection } from "./selection";
import { createSelection, createMultiSelection, singleSelection } from "./selection";
import { applyTransaction } from "./transform";
import { defaultSchema } from "../model/default-schema";
import { doc, p } from "../test-utils/builders";
import { createBlockNode, createTextNode, createMark, isBlockNode, isTextNode, nodesEqual } from "../model/types";

// Position convention (matches resolvePos):
// doc(p("ab")): pos 0=doc, 1=enter p (before a), 2=after a, 3=after b

function applyCommand(
  state: ReturnType<typeof createEditorState>,
  command: (state: ReturnType<typeof createEditorState>, dispatch?: (steps: readonly Step[], sel: MultiSelection) => void) => boolean,
) {
  let result = state;
  command(state, (steps, sel) => {
    result = applyTransaction(state, steps, sel);
  });
  return result;
}

describe("insertText", () => {
  test("inserts text at cursor", () => {
    // doc(p("ab")) with cursor at pos 2 (between a and b)
    const d = doc(p("ab"));
    const state = createEditorState(d, defaultSchema, singleSelection(2));
    const newState = applyCommand(state, insertText("X"));
    const expected = doc(p("aXb"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });

  test("replaces selected text", () => {
    // doc(p("hello")) with "ell" selected (pos 2-5)
    const d = doc(p("hello"));
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(2, 5)]));
    const newState = applyCommand(state, insertText("a"));
    const expected = doc(p("hao"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });

  test("inserts at multiple cursors", () => {
    // doc(p("ab cd")) with cursors at pos 2 (after a) and pos 5 (after c)
    const d = doc(p("ab cd"));
    const state = createEditorState(d, defaultSchema, createMultiSelection([
      createSelection(2),
      createSelection(5),
    ]));
    const newState = applyCommand(state, insertText("X"));
    const expected = doc(p("aXb cXd"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });
});

describe("deleteBackward", () => {
  test("deletes character before cursor", () => {
    // doc(p("abc")) with cursor at pos 3 (after 'b')
    const d = doc(p("abc"));
    const state = createEditorState(d, defaultSchema, singleSelection(3));
    const newState = applyCommand(state, deleteBackward);
    const expected = doc(p("ac"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });

  test("deletes selected range", () => {
    const d = doc(p("hello"));
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(2, 5)]));
    const newState = applyCommand(state, deleteBackward);
    const expected = doc(p("ho"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });
});

describe("deleteForward", () => {
  test("deletes character after cursor", () => {
    // doc(p("abc")) with cursor at pos 2 (after 'a')
    const d = doc(p("abc"));
    const state = createEditorState(d, defaultSchema, singleSelection(2));
    const newState = applyCommand(state, deleteForward);
    const expected = doc(p("ac"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
  });
});

describe("toggleBold", () => {
  test("adds bold to selected text", () => {
    const d = doc(p("hello"));
    // Select entire text: pos 1 (before h) to pos 6 (after o)
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(1, 6)]));
    const newState = applyCommand(state, toggleBold);

    const para = newState.doc.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        expect(text.marks.some(m => m.type === "bold")).toBe(true);
      }
    }
  });

  test("removes bold from already-bold text", () => {
    const d = doc(createBlockNode("paragraph", {}, [
      createTextNode("hello", [createMark("bold")]),
    ]));
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(1, 6)]));
    const newState = applyCommand(state, toggleBold);

    const para = newState.doc.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        expect(text.marks.some(m => m.type === "bold")).toBe(false);
      }
    }
  });

  test("returns true for can-apply check (no dispatch)", () => {
    const d = doc(p("hello"));
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(1, 6)]));
    expect(toggleBold(state)).toBe(true);
  });
});

describe("toggleItalic", () => {
  test("adds italic to selected text", () => {
    const d = doc(p("hello"));
    const state = createEditorState(d, defaultSchema, createMultiSelection([createSelection(1, 6)]));
    const newState = applyCommand(state, toggleItalic);

    const para = newState.doc.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        expect(text.marks.some(m => m.type === "italic")).toBe(true);
      }
    }
  });
});
