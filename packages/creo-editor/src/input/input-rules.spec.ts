import { describe, test, expect } from "bun:test";
import { checkInputRules, headingRule, bulletListRule, orderedListRule, blockquoteRule, codeBlockRule, horizontalRuleRule, defaultInputRules } from "./input-rules";
import { createEditorState } from "../state/editor-state";
import type { Step } from "../state/editor-state";
import type { MultiSelection } from "../state/selection";
import { singleSelection } from "../state/selection";
import { defaultSchema } from "../model/default-schema";
import { doc, p } from "../test-utils/builders";
import { applyTransaction } from "../state/transform";

// Helper: create state with text, cursor at end of text within the paragraph
function stateWithText(text: string, cursorAtEnd = true) {
  const d = doc(p(text));
  // doc(p("# ")) layout: pos 0=doc, 1=enter p, 2=#, 3=space, 4=exit p
  // Cursor at end of text within p: pos 1 + text.length
  const pos = cursorAtEnd ? 1 + text.length : 2;
  return createEditorState(d, defaultSchema, singleSelection(pos));
}

describe("checkInputRules", () => {
  test("heading rule matches '# '", () => {
    const state = stateWithText("# ");
    let dispatched = false;

    checkInputRules([headingRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("heading rule matches '### '", () => {
    const state = stateWithText("### ");
    let dispatched = false;

    checkInputRules([headingRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("heading rule does not match without space", () => {
    const state = stateWithText("###");
    let dispatched = false;

    checkInputRules([headingRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(false);
  });

  test("bullet list rule matches '- '", () => {
    const state = stateWithText("- ");
    let dispatched = false;

    checkInputRules([bulletListRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("bullet list rule matches '* '", () => {
    const state = stateWithText("* ");
    let dispatched = false;

    checkInputRules([bulletListRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("ordered list rule matches '1. '", () => {
    const state = stateWithText("1. ");
    let dispatched = false;

    checkInputRules([orderedListRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("blockquote rule matches '> '", () => {
    const state = stateWithText("> ");
    let dispatched = false;

    checkInputRules([blockquoteRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("code block rule matches '```'", () => {
    const state = stateWithText("``` ");
    let dispatched = false;

    checkInputRules([codeBlockRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("horizontal rule matches '--- '", () => {
    const state = stateWithText("--- ");
    let dispatched = false;

    checkInputRules([horizontalRuleRule()], state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(true);
  });

  test("no rule matches plain text", () => {
    const state = stateWithText("hello world");
    let dispatched = false;

    checkInputRules(defaultInputRules(), state, () => {
      dispatched = true;
    });

    expect(dispatched).toBe(false);
  });

  test("defaultInputRules returns all built-in rules", () => {
    const rules = defaultInputRules();
    expect(rules.length).toBe(6);
  });
});
