import { _ } from "creo";
import { div, view } from "creo";
import type { Store } from "creo";
import { isTextBearing } from "../model/blockText";
import { getBlock } from "../model/doc";
import type { Anchor, BlockId, DocState, Selection } from "../model/types";
import {
  anchorOffset,
  orderedRange,
  selectionStart,
} from "../controller/selection";
import {
  findBlockElement,
  measureCaretRect,
  measureSelectionRectsInBlock,
  type CaretRect,
  type SelectionRect,
} from "./measure";

/**
 * The caret + selection overlay layer.
 *
 * Subscribes ONLY to selStore, so a typed character that mutates docStore
 * doesn't cause this view to re-render — and a caret blink doesn't
 * reconcile any block. The overlay is a sibling of the document tree
 * inside the editor root (which has `position: relative`).
 *
 * Measurement happens in `onUpdateAfter` / `onMount`: by then the doc tree
 * is already laid out and we can read `getBoundingClientRect`. The
 * measurements get pushed back into local state, which triggers a SECOND
 * render of just this overlay. That secondary pass is cheap (one div + a
 * handful of rect divs).
 */

export type OverlayProps = {
  editorId: string;
  selStore: Store<Selection>;
  docStore: Store<DocState>;
};

type Measurement = {
  caret: CaretRect | null;
  selectionRects: SelectionRect[];
};

const EMPTY: Measurement = { caret: null, selectionRects: [] };

export const CaretOverlay = view<OverlayProps>(({ props, use }) => {
  const sel = use(props().selStore);
  const measurement = use<Measurement>(EMPTY);
  // We need to react to doc changes too — the line geometry can change when
  // text is added or blocks are added/removed.
  const doc = use(props().docStore);

  const recompute = () => {
    const root = document.querySelector(
      `[data-creo-editor="${props().editorId}"]`,
    ) as HTMLElement | null;
    if (!root) {
      measurement.set(EMPTY);
      return;
    }
    const next = computeMeasurement(root, doc.get(), sel.get());
    // Caret-following textarea: keep the hidden input glued to the caret.
    // iOS scroll-into-view + soft-keyboard logic depends on this.
    if (next.caret) {
      const ta = root.querySelector(
        `textarea[data-creo-input="${props().editorId}"]`,
      ) as HTMLTextAreaElement | null;
      if (ta) {
        ta.style.top = `${Math.max(0, next.caret.top)}px`;
        ta.style.left = `${Math.max(0, next.caret.left)}px`;
      }
    }
    // Avoid no-op re-renders.
    if (sameMeasurement(measurement.get(), next)) return;
    measurement.set(next);
  };

  return {
    onMount() {
      recompute();
    },
    onUpdateAfter() {
      recompute();
    },
    render() {
      const m = measurement.get();
      div(
        {
          class: "creo-overlay",
          style:
            "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;",
        },
        () => {
          // Selection rectangles (rendered behind the caret).
          //
          // `background: Highlight` is the CSS system-color keyword that
          // resolves to the OS's selection color. It's deprecated by name
          // but still implemented in every modern engine — there's no
          // currently-shipping non-deprecated alternative for "current
          // selection background." We expose `--creo-selection-bg` for
          // hosts that want a hard override.
          for (let i = 0; i < m.selectionRects.length; i++) {
            const r = m.selectionRects[i]!;
            div({
              class: "creo-selection-rect",
              key: `s${i}`,
              style:
                `position:absolute;` +
                `left:${r.left}px;top:${r.top}px;` +
                `width:${r.width}px;height:${r.height}px;` +
                `background:var(--creo-selection-bg, Highlight);` +
                `opacity:var(--creo-selection-opacity, 0.35);` +
                // mix-blend-mode: multiply keeps the underlying text
                // legible regardless of how dark the OS selection color is.
                `mix-blend-mode:multiply;`,
            });
          }
          // Caret (only when selection is collapsed).
          //
          // The blink animation uses two devices to match native behavior:
          //
          //   1. The element's `key` includes the position. When the caret
          //      moves, Creo unmounts the old div and mounts a new one,
          //      which restarts the CSS animation from time 0. Native
          //      caret stays solid the moment after a move; ours does the
          //      same because the animation's first cycle starts in the
          //      visible (`opacity: 1`) keyframe range.
          //
          //   2. `animation-delay: 530ms` keeps the caret fully solid for
          //      slightly more than half a second after each remount —
          //      matches the macOS / Windows native blink-onset interval.
          if (m.caret && sel.get().kind === "caret") {
            const c = m.caret;
            const at =
              sel.get().kind === "caret"
                ? (sel.get() as { at: { blockId: string; offset: number } }).at
                : null;
            const positionKey =
              at != null
                ? `caret:${at.blockId}:${at.offset}`
                : "caret";
            div({
              class: "creo-caret",
              key: positionKey,
              style:
                `position:absolute;` +
                `left:${c.left}px;top:${c.top}px;` +
                `width:1.5px;height:${c.height}px;` +
                `background:currentColor;` +
                `animation:creo-caret-blink 1s step-end infinite;` +
                `animation-delay:0.53s;`,
            });
          }
        },
      );
      void _;
    },
  };
});

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

function computeMeasurement(
  root: HTMLElement,
  doc: DocState,
  sel: Selection,
): Measurement {
  if (sel.kind === "caret") {
    const caret = caretRectFor(root, doc, sel.at);
    return { caret, selectionRects: [] };
  }
  const { start, end } = orderedRange(doc, sel);
  const caret = caretRectFor(root, doc, selectionStart(sel));
  const rects = collectSelectionRects(root, doc, start, end);
  return { caret, selectionRects: rects };
}

function caretRectFor(
  root: HTMLElement,
  doc: DocState,
  a: Anchor,
): CaretRect | null {
  if (!a.blockId) return null;
  const block = getBlock(doc, a.blockId);
  if (!block) return null;
  // For tables and columns the anchor's path identifies a specific cell
  // inside the block. Measuring against the OUTER block element gives an
  // offset-0 = top-left position, which is why the visible caret stayed
  // in cell [0][0] no matter where the user actually typed. Drill into
  // the matching <td data-cell="r:c"> / [data-col="c"] and measure
  // there with the cell-local character offset.
  if (block.type === "table" && a.path.length >= 3) {
    const r = a.path[0]!;
    const c = a.path[1]!;
    const off = a.path[2]!;
    const td = root.querySelector(
      `td[data-block-id="${cssEscape(a.blockId)}"][data-cell="${r}:${c}"]`,
    ) as HTMLElement | null;
    if (td) return measureCaretRect(td, off, root);
    return null;
  }
  if (block.type === "columns" && a.path.length >= 2) {
    const c = a.path[0]!;
    const off = a.path[1]!;
    const colEl = root.querySelector(
      `[data-block-id="${cssEscape(a.blockId)}"][data-col="${c}"]`,
    ) as HTMLElement | null;
    if (colEl) return measureCaretRect(colEl, off, root);
    return null;
  }
  const el = findBlockElement(root, a.blockId);
  if (!el) return null;
  const offset = isTextBearing(block) ? anchorOffset(a) : 0;
  return measureCaretRect(el, offset, root);
}

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, "\\$1");
}

function collectSelectionRects(
  root: HTMLElement,
  doc: DocState,
  start: Anchor,
  end: Anchor,
): SelectionRect[] {
  if (start.blockId === end.blockId) {
    return blockRangeRects(root, doc, start.blockId, anchorOffset(start), anchorOffset(end));
  }
  // Cross-block range — emit each block's contribution in document order.
  const out: SelectionRect[] = [];
  let inSpan = false;
  for (const id of doc.order) {
    if (id === start.blockId) {
      inSpan = true;
      out.push(...tailRects(root, doc, id, anchorOffset(start)));
      continue;
    }
    if (id === end.blockId) {
      out.push(...headRects(root, doc, id, anchorOffset(end)));
      break;
    }
    if (inSpan) {
      out.push(...wholeBlockRects(root, doc, id));
    }
  }
  return out;
}

function blockRangeRects(
  root: HTMLElement,
  _doc: DocState,
  blockId: BlockId,
  s: number,
  e: number,
): SelectionRect[] {
  const el = findBlockElement(root, blockId);
  if (!el) return [];
  return measureSelectionRectsInBlock(el, s, e, root);
}

function tailRects(
  root: HTMLElement,
  doc: DocState,
  blockId: BlockId,
  s: number,
): SelectionRect[] {
  const block = getBlock(doc, blockId);
  if (!block || !isTextBearing(block)) return [];
  const el = findBlockElement(root, blockId);
  if (!el) return [];
  // To end of block — measure the textual length first.
  const len = textLength(el);
  return measureSelectionRectsInBlock(el, s, len, root);
}

function headRects(
  root: HTMLElement,
  doc: DocState,
  blockId: BlockId,
  e: number,
): SelectionRect[] {
  const block = getBlock(doc, blockId);
  if (!block || !isTextBearing(block)) return [];
  const el = findBlockElement(root, blockId);
  if (!el) return [];
  return measureSelectionRectsInBlock(el, 0, e, root);
}

function wholeBlockRects(
  root: HTMLElement,
  doc: DocState,
  blockId: BlockId,
): SelectionRect[] {
  const block = getBlock(doc, blockId);
  if (!block || !isTextBearing(block)) return [];
  const el = findBlockElement(root, blockId);
  if (!el) return [];
  const len = textLength(el);
  return measureSelectionRectsInBlock(el, 0, len, root);
}

const ZWSP = "​";
function textLength(el: HTMLElement): number {
  let total = 0;
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      const t = (n as Text).data;
      if (t !== ZWSP) total += t.length;
      return;
    }
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(el);
  return total;
}

function sameMeasurement(a: Measurement, b: Measurement): boolean {
  const ac = a.caret;
  const bc = b.caret;
  if ((ac == null) !== (bc == null)) return false;
  if (ac && bc && (ac.left !== bc.left || ac.top !== bc.top || ac.height !== bc.height)) {
    return false;
  }
  if (a.selectionRects.length !== b.selectionRects.length) return false;
  for (let i = 0; i < a.selectionRects.length; i++) {
    const ra = a.selectionRects[i]!;
    const rb = b.selectionRects[i]!;
    if (
      ra.left !== rb.left ||
      ra.top !== rb.top ||
      ra.width !== rb.width ||
      ra.height !== rb.height
    ) {
      return false;
    }
  }
  return true;
}
