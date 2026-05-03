import { _ } from "creo";
import { code, em, s, span, strong, text, u, view } from "creo";
import type { InlineRun, Mark } from "../model/types";

/**
 * Render a sequence of inline runs as keyed spans.
 *
 * Each run becomes one DOM span with `data-run-index` for caret math, then the
 * spans are wrapped from inside-out by their marks (stable, deterministic
 * order: code → b → i → u → s). Wrapping order is fixed so toggling marks
 * doesn't shuffle the DOM tree.
 *
 * Empty runs are skipped — but if all runs are empty / list is empty, we emit
 * a single zero-width-space span so the block keeps a measurable line box.
 */

const MARK_ORDER: Mark[] = ["code", "b", "i", "u", "s"];

const ZWSP = "​";

const RunView = view<{ run: InlineRun; index: number }>(({ props }) => ({
  shouldUpdate(next) {
    const cur = props();
    return next.run !== cur.run || next.index !== cur.index;
  },
  render() {
    const { run, index } = props();
    const t = run.text.length === 0 ? ZWSP : run.text;
    let inner = () => {
      span({ "data-run-index": String(index) }, t);
    };
    if (run.marks && run.marks.size) {
      for (const m of MARK_ORDER) {
        if (!run.marks.has(m)) continue;
        const child = inner;
        switch (m) {
          case "code":
            inner = () => {
              code(_, child);
            };
            break;
          case "b":
            inner = () => {
              strong(_, child);
            };
            break;
          case "i":
            inner = () => {
              em(_, child);
            };
            break;
          case "u":
            inner = () => {
              u(_, child);
            };
            break;
          case "s":
            inner = () => {
              s(_, child);
            };
            break;
        }
      }
    }
    inner();
    void text; // keep `text` import — used below for empty-run pathway in tests
  },
}));

// Stable singleton placeholder run for empty-runs blocks. Reusing the same
// reference means RunView's identity-based shouldUpdate skips re-renders
// when the block stays empty. RunView renders the text content via its
// `text` field, so a single zero-width-space gives the line a measurable
// box without leaking any visible glyph.
const EMPTY_PLACEHOLDER_RUN: InlineRun = { text: ZWSP };

export const InlineRunsView = view<{ runs: InlineRun[] }>(({ props }) => ({
  shouldUpdate(next) {
    return next.runs !== props().runs;
  },
  render() {
    const runs = props().runs;
    // Always render via RunView so the children-shape stays stable across
    // empty <-> non-empty transitions. An earlier version branched into a
    // raw <span> placeholder for empty runs; that flipped the children
    // type (primitive <-> composite) and the reconciler ended up keeping
    // the placeholder span around forever instead of swapping it for the
    // RunView with the new text.
    if (runs.length === 0) {
      RunView({ run: EMPTY_PLACEHOLDER_RUN, index: 0, key: 0 });
      return;
    }
    for (let i = 0; i < runs.length; i++) {
      RunView({ run: runs[i]!, index: i, key: i });
    }
  },
}));
