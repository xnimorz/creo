import { describe, test, expect } from "bun:test";
import { applyStep, applyTransaction } from "./transform";
import {
  replaceStep,
  addMarkStep,
  removeMarkStep,
  setNodeAttrStep,
  createEditorState,
} from "./editor-state";
import { singleSelection } from "./selection";
import { defaultSchema } from "../model/default-schema";
import {
  createBlockNode,
  createTextNode,
  createMark,
  createSlice,
  createPos,
  emptySlice,
  nodesEqual,
  isTextNode,
  isBlockNode,
} from "../model/types";
import { doc, p, heading, blockquote, bold, italic } from "../test-utils/builders";

// Position convention (matches resolvePos):
// doc(p("hello")): pos 0=doc start, 1=enter p (before h), 2=after h, 3=after e, etc.

// ── Replace step ───────────────────────────────────────────────────────

describe("applyStep: replace", () => {
  test("insert text into empty paragraph", () => {
    const d = doc(createBlockNode("paragraph"));
    // pos 1 = inside empty paragraph
    const step = replaceStep(1, 1, createSlice([createTextNode("hello")]));
    const result = applyStep(d, step);
    const expected = doc(p("hello"));
    expect(nodesEqual(result.doc, expected)).toBe(true);
  });

  test("delete text from paragraph", () => {
    // doc(p("hello")): pos 1=before h, 2=after h, 3=after e, 4=after l, 5=after l, 6=after o
    const d = doc(p("hello"));
    // Delete "ell" = from pos 2 (after h) to pos 5 (after second l)
    const step = replaceStep(2, 5, emptySlice);
    const result = applyStep(d, step);
    const expected = doc(p("ho"));
    expect(nodesEqual(result.doc, expected)).toBe(true);
  });

  test("replace text in paragraph", () => {
    const d = doc(p("hello"));
    // Replace "ell" (pos 2-5) with "a"
    const step = replaceStep(2, 5, createSlice([createTextNode("a")]));
    const result = applyStep(d, step);
    const expected = doc(p("hao"));
    expect(nodesEqual(result.doc, expected)).toBe(true);
  });

  test("position mapping after insert", () => {
    const d = doc(p("ab"));
    // pos 1=before a, 2=between a and b, 3=after b
    // Insert "X" at position 2 (between a and b)
    const step = replaceStep(2, 2, createSlice([createTextNode("X")]));
    const result = applyStep(d, step);

    // Positions before insertion point should be unchanged
    expect(result.mapping.map(createPos(1)) as number).toBe(1);
    // Position at insertion point stays
    expect(result.mapping.map(createPos(2)) as number).toBe(2);
    // Positions after should shift by 1
    expect(result.mapping.map(createPos(3)) as number).toBe(4);
  });

  test("position mapping after deletion", () => {
    const d = doc(p("abcd"));
    // pos 1=before a, 2=after a, 3=after b, 4=after c, 5=after d
    // Delete "bc" (pos 2-4)
    const step = replaceStep(2, 4, emptySlice);
    const result = applyStep(d, step);

    // Before range: unchanged
    expect(result.mapping.map(createPos(1)) as number).toBe(1);
    // Inside deleted range: maps to end of deletion
    expect(result.mapping.map(createPos(3)) as number).toBe(2);
    // After range: shifts back by 2
    expect(result.mapping.map(createPos(5)) as number).toBe(3);
  });
});

// ── AddMark step ───────────────────────────────────────────────────────

describe("applyStep: addMark", () => {
  test("adds bold mark to text", () => {
    const d = doc(p("hello"));
    // Mark entire text: pos 1 (before h) to pos 6 (after o)
    const step = addMarkStep(1, 6, { type: "bold", attrs: {} });
    const result = applyStep(d, step);

    const para = result.doc.content[0]!;
    expect(isBlockNode(para)).toBe(true);
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      expect(isTextNode(text)).toBe(true);
      if (isTextNode(text)) {
        expect(text.marks.some(m => m.type === "bold")).toBe(true);
      }
    }
  });

  test("doesn't duplicate existing mark", () => {
    const d = doc(
      createBlockNode("paragraph", {}, [
        createTextNode("hello", [createMark("bold")]),
      ]),
    );
    const step = addMarkStep(1, 6, { type: "bold", attrs: {} });
    const result = applyStep(d, step);

    const para = result.doc.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        const boldCount = text.marks.filter(m => m.type === "bold").length;
        expect(boldCount).toBe(1);
      }
    }
  });
});

// ── RemoveMark step ────────────────────────────────────────────────────

describe("applyStep: removeMark", () => {
  test("removes bold mark from text", () => {
    const d = doc(
      createBlockNode("paragraph", {}, [
        createTextNode("hello", [createMark("bold")]),
      ]),
    );
    const step = removeMarkStep(1, 6, "bold");
    const result = applyStep(d, step);

    const para = result.doc.content[0]!;
    if (isBlockNode(para)) {
      const text = para.content[0]!;
      if (isTextNode(text)) {
        expect(text.marks.some(m => m.type === "bold")).toBe(false);
      }
    }
  });

  test("no-op when mark not present", () => {
    const d = doc(p("hello"));
    const step = removeMarkStep(1, 6, "bold");
    const result = applyStep(d, step);
    expect(nodesEqual(result.doc, d)).toBe(true);
  });
});

// ── SetNodeAttr step ───────────────────────────────────────────────────

describe("applyStep: setNodeAttr", () => {
  test("changes heading level", () => {
    const d = doc(heading({ level: 1 }, "Title"));
    // The heading node is at position 0 in doc content
    // setNodeAttr pos should point to inside the heading
    // Heading is the first child of doc, at position 0 in doc's content
    const step = setNodeAttrStep(0, "level", 2, 1);
    const result = applyStep(d, step);

    const h = result.doc.content[0]!;
    if (isBlockNode(h)) {
      expect((h.attrs as Record<string, unknown>)["level"]).toBe(2);
    }
  });
});

// ── Transaction application ────────────────────────────────────────────

describe("applyTransaction", () => {
  test("applies multiple steps", () => {
    const d = doc(p("hello"));
    const state = createEditorState(d, defaultSchema);

    // Step 1: Delete "ell" (pos 2-5) → "ho"
    // Step 2: Insert "ey" at pos 2 (after h) → "heyo"
    const step1 = replaceStep(2, 5, emptySlice);
    const step2 = replaceStep(2, 2, createSlice([createTextNode("ey")]));

    const newState = applyTransaction(state, [step1, step2], singleSelection(4));

    const expected = doc(p("heyo"));
    expect(nodesEqual(newState.doc, expected)).toBe(true);
    expect(newState.selection.ranges[0]!.anchor as number).toBe(4);
  });
});
