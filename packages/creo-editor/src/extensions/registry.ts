/**
 * Extension Registry — merges extensions into a unified editor config.
 */

import type { NodeSpec, MarkSpec, Schema } from "../model/schema";
import { createSchema } from "../model/schema";
import { defaultSchema } from "../model/default-schema";
import type { KeyBinding, CommandFn } from "../input/keymap";
import type { InputRule } from "../input/input-rules";
import type { Extension, NodeViewFactory, ToolbarItem } from "./types";

// ── Merged config ──────────────────────────────────────────────────────

export interface MergedExtensionConfig {
  readonly schema: Schema;
  readonly keybindings: readonly KeyBinding[];
  readonly commands: Readonly<Record<string, CommandFn>>;
  readonly inputRules: readonly InputRule[];
  readonly nodeViews: Readonly<Record<string, NodeViewFactory>>;
  readonly toolbarItems: readonly ToolbarItem[];
}

// ── Merge extensions ───────────────────────────────────────────────────

export function mergeExtensions(extensions: readonly Extension[]): MergedExtensionConfig {
  const nodes: Record<string, NodeSpec> = { ...defaultSchema.nodes };
  const marks: Record<string, MarkSpec> = { ...defaultSchema.marks };
  const keybindings: KeyBinding[] = [];
  const commands: Record<string, CommandFn> = {};
  const inputRules: InputRule[] = [];
  const nodeViews: Record<string, NodeViewFactory> = {};
  const toolbarItems: ToolbarItem[] = [];

  const seenNames = new Set<string>();

  for (const ext of extensions) {
    // Check for duplicate names
    if (seenNames.has(ext.name)) {
      throw new Error(`Duplicate extension name: "${ext.name}"`);
    }
    seenNames.add(ext.name);

    // Merge nodes
    if (ext.nodes) {
      for (const [name, spec] of Object.entries(ext.nodes)) {
        if (nodes[name]) {
          throw new Error(
            `Extension "${ext.name}" defines node type "${name}" which already exists. ` +
            `Node types must be unique across all extensions.`,
          );
        }
        nodes[name] = spec;
      }
    }

    // Merge marks
    if (ext.marks) {
      for (const [name, spec] of Object.entries(ext.marks)) {
        if (marks[name]) {
          throw new Error(
            `Extension "${ext.name}" defines mark type "${name}" which already exists.`,
          );
        }
        marks[name] = spec;
      }
    }

    // Merge keybindings (extensions can override — later wins)
    if (ext.keymap) {
      keybindings.push(...ext.keymap);
    }

    // Merge commands
    if (ext.commands) {
      for (const [name, fn] of Object.entries(ext.commands)) {
        if (commands[name]) {
          throw new Error(
            `Extension "${ext.name}" defines command "${name}" which already exists.`,
          );
        }
        commands[name] = fn;
      }
    }

    // Merge input rules
    if (ext.inputRules) {
      inputRules.push(...ext.inputRules);
    }

    // Merge node views
    if (ext.nodeViews) {
      for (const [name, factory] of Object.entries(ext.nodeViews)) {
        if (nodeViews[name]) {
          throw new Error(
            `Extension "${ext.name}" defines node view for "${name}" which already exists.`,
          );
        }
        nodeViews[name] = factory;
      }
    }

    // Merge toolbar items
    if (ext.toolbarItems) {
      toolbarItems.push(...ext.toolbarItems);
    }
  }

  return {
    schema: createSchema(nodes, marks),
    keybindings,
    commands,
    inputRules,
    nodeViews,
    toolbarItems,
  };
}
