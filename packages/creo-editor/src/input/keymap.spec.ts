import { describe, test, expect } from "bun:test";
import { parseKeyCombo, matchesKeyEvent, createKeymap } from "./keymap";

// Helper to create a mock KeyboardEvent
function mockKeyEvent(opts: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    code: opts.code ?? "",
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as KeyboardEvent;
}

describe("parseKeyCombo", () => {
  test("simple key", () => {
    const parsed = parseKeyCombo("Enter");
    expect(parsed.key).toBe("enter");
    expect(parsed.mod).toBe(false);
    expect(parsed.shift).toBe(false);
    expect(parsed.alt).toBe(false);
  });

  test("Mod-b", () => {
    const parsed = parseKeyCombo("Mod-b");
    expect(parsed.key).toBe("b");
    expect(parsed.mod).toBe(true);
    expect(parsed.shift).toBe(false);
  });

  test("Mod-Shift-1", () => {
    const parsed = parseKeyCombo("Mod-Shift-1");
    expect(parsed.key).toBe("1");
    expect(parsed.mod).toBe(true);
    expect(parsed.shift).toBe(true);
  });

  test("Alt-Enter", () => {
    const parsed = parseKeyCombo("Alt-Enter");
    expect(parsed.key).toBe("enter");
    expect(parsed.alt).toBe(true);
  });
});

describe("matchesKeyEvent", () => {
  test("matches Ctrl+B (non-Mac)", () => {
    const parsed = parseKeyCombo("Mod-b");
    const event = mockKeyEvent({ key: "b", ctrlKey: true });
    // On non-Mac, Mod = Ctrl
    expect(matchesKeyEvent(parsed, event)).toBe(true);
  });

  test("does not match without modifier", () => {
    const parsed = parseKeyCombo("Mod-b");
    const event = mockKeyEvent({ key: "b" });
    expect(matchesKeyEvent(parsed, event)).toBe(false);
  });

  test("matches Enter without modifiers", () => {
    const parsed = parseKeyCombo("Enter");
    const event = mockKeyEvent({ key: "Enter" });
    expect(matchesKeyEvent(parsed, event)).toBe(true);
  });

  test("does not match Enter with Ctrl", () => {
    const parsed = parseKeyCombo("Enter");
    const event = mockKeyEvent({ key: "Enter", ctrlKey: true });
    expect(matchesKeyEvent(parsed, event)).toBe(false);
  });

  test("matches Shift-Enter", () => {
    const parsed = parseKeyCombo("Shift-Enter");
    const event = mockKeyEvent({ key: "Enter", shiftKey: true });
    expect(matchesKeyEvent(parsed, event)).toBe(true);
  });
});

describe("createKeymap", () => {
  test("executes matching command", () => {
    let called = false;
    const keymap = createKeymap([
      {
        key: "Mod-b",
        command: (_state, _dispatch) => {
          called = true;
          return true;
        },
      },
    ]);

    const event = mockKeyEvent({ key: "b", ctrlKey: true });
    const state = {} as import("../state/editor-state").EditorState;

    const handled = keymap.handleKeyDown(event, state, () => {});
    expect(handled).toBe(true);
    expect(called).toBe(true);
  });

  test("skips non-matching commands", () => {
    let called = false;
    const keymap = createKeymap([
      {
        key: "Mod-b",
        command: () => {
          called = true;
          return true;
        },
      },
    ]);

    const event = mockKeyEvent({ key: "i", ctrlKey: true });
    const state = {} as import("../state/editor-state").EditorState;

    const handled = keymap.handleKeyDown(event, state, () => {});
    expect(handled).toBe(false);
    expect(called).toBe(false);
  });

  test("respects when predicate", () => {
    let called = false;
    const keymap = createKeymap([
      {
        key: "Enter",
        when: () => false, // Never active
        command: () => {
          called = true;
          return true;
        },
      },
    ]);

    const event = mockKeyEvent({ key: "Enter" });
    const state = {} as import("../state/editor-state").EditorState;

    const handled = keymap.handleKeyDown(event, state, () => {});
    expect(handled).toBe(false);
    expect(called).toBe(false);
  });
});
