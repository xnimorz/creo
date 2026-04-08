import { describe, test, expect } from "bun:test";
import { mergeExtensions } from "./registry";
import type { Extension } from "./types";

describe("mergeExtensions", () => {
  test("merges empty extension list", () => {
    const config = mergeExtensions([]);
    expect(config.schema.nodes["paragraph"]).toBeDefined();
    expect(config.schema.marks["bold"]).toBeDefined();
    expect(config.keybindings.length).toBe(0);
    expect(config.inputRules.length).toBe(0);
  });

  test("merges extension with new node type", () => {
    const ext: Extension = {
      name: "test-ext",
      nodes: {
        custom_block: {
          content: "inline*",
          group: "block",
        },
      },
    };

    const config = mergeExtensions([ext]);
    expect(config.schema.nodes["custom_block"]).toBeDefined();
    expect(config.schema.nodes["paragraph"]).toBeDefined(); // default still present
  });

  test("merges extension with new mark type", () => {
    const ext: Extension = {
      name: "highlight",
      marks: {
        highlight: {
          attrs: { color: { default: "yellow" } },
        },
      },
    };

    const config = mergeExtensions([ext]);
    expect(config.schema.marks["highlight"]).toBeDefined();
    expect(config.schema.marks["bold"]).toBeDefined(); // default still present
  });

  test("merges keybindings from multiple extensions", () => {
    const ext1: Extension = {
      name: "ext1",
      keymap: [{ key: "Mod-1", command: () => true }],
    };
    const ext2: Extension = {
      name: "ext2",
      keymap: [{ key: "Mod-2", command: () => true }],
    };

    const config = mergeExtensions([ext1, ext2]);
    expect(config.keybindings.length).toBe(2);
  });

  test("merges commands", () => {
    const ext: Extension = {
      name: "test",
      commands: {
        myCommand: () => true,
      },
    };

    const config = mergeExtensions([ext]);
    expect(config.commands["myCommand"]).toBeDefined();
  });

  test("merges input rules", () => {
    const ext: Extension = {
      name: "test",
      inputRules: [{ match: /^test$/, handler: () => true }],
    };

    const config = mergeExtensions([ext]);
    expect(config.inputRules.length).toBe(1);
  });

  test("merges toolbar items", () => {
    const ext: Extension = {
      name: "test",
      toolbarItems: [{ id: "test", label: "Test", command: () => true }],
    };

    const config = mergeExtensions([ext]);
    expect(config.toolbarItems.length).toBe(1);
  });

  test("throws on duplicate extension names", () => {
    const ext1: Extension = { name: "same" };
    const ext2: Extension = { name: "same" };

    expect(() => mergeExtensions([ext1, ext2])).toThrow("Duplicate extension name");
  });

  test("throws on duplicate node types", () => {
    const ext1: Extension = {
      name: "ext1",
      nodes: { custom: { content: "" } },
    };
    const ext2: Extension = {
      name: "ext2",
      nodes: { custom: { content: "" } },
    };

    expect(() => mergeExtensions([ext1, ext2])).toThrow("already exists");
  });

  test("throws on duplicate mark types", () => {
    const ext1: Extension = {
      name: "ext1",
      marks: { custom: {} },
    };
    const ext2: Extension = {
      name: "ext2",
      marks: { custom: {} },
    };

    expect(() => mergeExtensions([ext1, ext2])).toThrow("already exists");
  });

  test("throws on duplicate command names", () => {
    const ext1: Extension = {
      name: "ext1",
      commands: { doThing: () => true },
    };
    const ext2: Extension = {
      name: "ext2",
      commands: { doThing: () => true },
    };

    expect(() => mergeExtensions([ext1, ext2])).toThrow("already exists");
  });

  test("throws on conflicting node views", () => {
    const ext1: Extension = {
      name: "ext1",
      nodeViews: {
        custom: () => ({ dom: null as unknown as HTMLElement }),
      },
    };
    const ext2: Extension = {
      name: "ext2",
      nodeViews: {
        custom: () => ({ dom: null as unknown as HTMLElement }),
      },
    };

    expect(() => mergeExtensions([ext1, ext2])).toThrow("already exists");
  });
});
