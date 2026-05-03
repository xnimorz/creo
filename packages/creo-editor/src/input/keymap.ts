import type { Mark } from "../model/types";
import type { SetBlockTypePayload } from "../commands/structuralCommands";

/**
 * Cross-platform "mod" key — ⌘ on macOS, Ctrl elsewhere.
 *
 * The detection is conservative: we look at navigator.platform first; in
 * test / SSR environments (no navigator) we default to non-mac.
 */
export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const p = (navigator as { platform?: string; userAgent?: string });
  if (p.platform) return /Mac|iPhone|iPod|iPad/i.test(p.platform);
  if (p.userAgent) return /Mac|iPhone|iPod|iPad/i.test(p.userAgent);
  return false;
}

export type KeymapHit =
  | { kind: "toggleMark"; mark: Mark }
  | { kind: "setBlockType"; payload: SetBlockTypePayload }
  | { kind: "indent" }
  | { kind: "outdent" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "selectAll" }
  // Word + line + doc navigation chords. extend = shift held.
  | { kind: "moveWord"; direction: -1 | 1; extend: boolean }
  | { kind: "moveLineEdge"; direction: -1 | 1; extend: boolean }
  | { kind: "moveDocEdge"; direction: -1 | 1; extend: boolean };

/**
 * Match a keyboard event against the default chord table. Returns the hit if
 * the key is a known chord, else `null` so the caller can fall through to
 * navigation / text editing.
 *
 * The matcher is intentionally event-oriented rather than string-oriented;
 * it sidesteps the "Ctrl+Shift+K" parsing rabbit-hole.
 */
export function matchKeymap(e: KeyboardEvent): KeymapHit | null {
  const mod = isMac() ? e.metaKey : e.ctrlKey;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod && !e.altKey && !e.shiftKey) {
    switch (lower) {
      case "b":
        return { kind: "toggleMark", mark: "b" };
      case "i":
        return { kind: "toggleMark", mark: "i" };
      case "u":
        return { kind: "toggleMark", mark: "u" };
      case "z":
        return { kind: "undo" };
      case "a":
        return { kind: "selectAll" };
    }
  }
  if (mod && e.shiftKey && !e.altKey) {
    switch (lower) {
      case "s":
        return { kind: "toggleMark", mark: "s" };
      case "z":
        return { kind: "redo" };
    }
  }
  // Cmd+Alt+1..6 → headings (matches Notion / Google Docs).
  if (mod && e.altKey && !e.shiftKey) {
    if (key >= "1" && key <= "6") {
      const lvl = Number(key) as 1 | 2 | 3 | 4 | 5 | 6;
      return {
        kind: "setBlockType",
        payload: { type: (`h${lvl}` as `h${1 | 2 | 3 | 4 | 5 | 6}`) },
      };
    }
    if (lower === "0") {
      return { kind: "setBlockType", payload: { type: "p" } };
    }
  }
  // Tab / Shift-Tab — list indent / outdent. Pure key, no modifier.
  if (!mod && !e.altKey) {
    if (key === "Tab") {
      return e.shiftKey ? { kind: "outdent" } : { kind: "indent" };
    }
  }

  // -----------------------------------------------------------------------
  // Arrow / Home / End chord variants
  // -----------------------------------------------------------------------
  // macOS conventions:
  //   Option+Left/Right    → word
  //   Cmd+Left/Right       → line edge (Home/End)
  //   Cmd+Up/Down          → doc edge
  // Windows / Linux conventions:
  //   Ctrl+Left/Right      → word
  //   Home/End             → line edge (already handled in pipeline)
  //   Ctrl+Home/End        → doc edge (already handled in pipeline)
  //   Ctrl+Up/Down         → paragraph (we treat same as block-jump default)
  if (isMac()) {
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      if (key === "ArrowLeft") return { kind: "moveWord", direction: -1, extend: e.shiftKey };
      if (key === "ArrowRight") return { kind: "moveWord", direction: 1, extend: e.shiftKey };
    }
    if (e.metaKey && !e.altKey && !e.ctrlKey) {
      if (key === "ArrowLeft") return { kind: "moveLineEdge", direction: -1, extend: e.shiftKey };
      if (key === "ArrowRight") return { kind: "moveLineEdge", direction: 1, extend: e.shiftKey };
      if (key === "ArrowUp") return { kind: "moveDocEdge", direction: -1, extend: e.shiftKey };
      if (key === "ArrowDown") return { kind: "moveDocEdge", direction: 1, extend: e.shiftKey };
    }
  } else {
    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      if (key === "ArrowLeft") return { kind: "moveWord", direction: -1, extend: e.shiftKey };
      if (key === "ArrowRight") return { kind: "moveWord", direction: 1, extend: e.shiftKey };
      // Ctrl+Up/Down: jump to paragraph above/below — handled by the
      // pipeline's plain ArrowUp/Down already (block-jump fallback). No
      // distinct chord needed here.
    }
  }

  return null;
}
