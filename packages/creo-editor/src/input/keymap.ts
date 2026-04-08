/**
 * Keyboard shortcut system.
 *
 * Key notation: "Mod-b" where Mod = Cmd (mac) or Ctrl (other).
 * Supports: Mod, Shift, Alt, plus any key name.
 */

import type { EditorState } from "../state/editor-state";

export type CommandFn = (
  state: EditorState,
  dispatch?: (steps: readonly import("../state/editor-state").Step[], selection: import("../state/selection").MultiSelection) => void,
) => boolean;

export interface KeyBinding {
  /** Key combination: "Mod-b", "Mod-Shift-1", "Enter", "Backspace" */
  readonly key: string;
  /** Command to execute. */
  readonly command: CommandFn;
  /** Optional predicate — only run if this returns true. */
  readonly when?: (state: EditorState) => boolean;
}

// ── Key parsing ────────────────────────────────────────────────────────

interface ParsedKey {
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly key: string; // lowercase key name
}

const isMac = typeof navigator !== "undefined"
  ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  : false;

export function parseKeyCombo(combo: string): ParsedKey {
  const parts = combo.split("-");
  let mod = false;
  let shift = false;
  let alt = false;
  let key = "";

  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "mod":
        mod = true;
        break;
      case "shift":
        shift = true;
        break;
      case "alt":
        alt = true;
        break;
      default:
        key = part.toLowerCase();
        break;
    }
  }

  return { mod, shift, alt, key };
}

export function matchesKeyEvent(parsed: ParsedKey, event: KeyboardEvent): boolean {
  // Check modifier keys
  const modKey = isMac ? event.metaKey : event.ctrlKey;
  if (parsed.mod !== modKey) return false;
  if (parsed.shift !== event.shiftKey) return false;
  if (parsed.alt !== event.altKey) return false;

  // Check the actual key
  const eventKey = event.key.toLowerCase();
  if (parsed.key === eventKey) return true;

  // Also check by code for number keys
  if (parsed.key.length === 1 && parsed.key >= "0" && parsed.key <= "9") {
    if (event.code === `Digit${parsed.key}`) return true;
  }

  return false;
}

// ── Keymap execution ───────────────────────────────────────────────────

export interface Keymap {
  readonly bindings: readonly KeyBinding[];

  /**
   * Handle a keyboard event. Returns true if a binding matched and
   * the command returned true (consumed the event).
   */
  handleKeyDown(
    event: KeyboardEvent,
    state: EditorState,
    dispatch: (steps: readonly import("../state/editor-state").Step[], selection: import("../state/selection").MultiSelection) => void,
  ): boolean;
}

export function createKeymap(bindings: readonly KeyBinding[]): Keymap {
  // Pre-parse all key combos for efficiency
  const parsed = bindings.map(b => ({
    binding: b,
    parsed: parseKeyCombo(b.key),
  }));

  return {
    bindings,

    handleKeyDown(event, state, dispatch) {
      for (const { binding, parsed: p } of parsed) {
        if (!matchesKeyEvent(p, event)) continue;
        if (binding.when && !binding.when(state)) continue;

        const result = binding.command(state, dispatch);
        if (result) return true;
      }
      return false;
    },
  };
}
