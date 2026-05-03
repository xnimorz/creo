import { _ } from "creo";
import { div, view } from "creo";
import type { Store } from "creo";
import { isCoarsePointer } from "../input/mobile";
import {
  anchorOffset,
  caret,
  orderedRange,
  range,
  selectionEnd,
  selectionStart,
} from "../controller/selection";
import { isTextBearing } from "../model/blockText";
import { getBlock } from "../model/doc";
import type {
  Anchor,
  DocState,
  Selection,
} from "../model/types";
import { findBlockElement, measureCaretRect, pointToAnchor } from "./measure";

/**
 * Selection handles — two 44×44 touch targets at the start / end of a
 * non-collapsed range. Mobile only (coarse pointer).
 *
 * Dragging a handle re-issues moveCursor with extend:true, snapping to the
 * nearest character via pointToAnchor on each pointermove. Handles auto-hide
 * on caret-only selection or on text input (the selStore subscription
 * naturally handles both).
 */

export type SelectionHandlesProps = {
  editorId: string;
  selStore: Store<Selection>;
  docStore: Store<DocState>;
};

const HANDLE_SIZE = 44;

type HandleDot = { left: number; top: number; height: number };

type State = {
  start: HandleDot | null;
  end: HandleDot | null;
};

const NONE: State = { start: null, end: null };

export const SelectionHandles = view<SelectionHandlesProps>(
  ({ props, use }) => {
    const sel = use(props().selStore);
    // Subscribe so we recompute when the doc changes too (line wraps, etc).
    const doc = use(props().docStore);
    const state = use<State>(NONE);

    const recompute = () => {
      const root = document.querySelector(
        `[data-creo-editor="${props().editorId}"]`,
      ) as HTMLElement | null;
      if (!root || sel.get().kind !== "range") {
        if (state.get() !== NONE) state.set(NONE);
        return;
      }
      const { start, end } = orderedRange(doc.get(), sel.get());
      const startDot = anchorToDot(root, doc.get(), start);
      const endDot = anchorToDot(root, doc.get(), end);
      const next: State = { start: startDot, end: endDot };
      if (sameState(state.get(), next)) return;
      state.set(next);
    };

    let dragging: "start" | "end" | null = null;

    const onPointerDown = (which: "start" | "end") => () => {
      dragging = which;
      const onMove = (ev: PointerEvent) => {
        if (!dragging) return;
        const root = document.querySelector(
          `[data-creo-editor="${props().editorId}"]`,
        ) as HTMLElement | null;
        if (!root) return;
        const anchor = pointToAnchor(
          doc.get(),
          root,
          ev.clientX,
          ev.clientY,
        );
        if (!anchor) return;
        const cur = sel.get();
        const otherSide =
          dragging === "start"
            ? selectionEnd(cur)
            : selectionStart(cur);
        // Set range with the dragged side as the focus.
        const next =
          dragging === "start"
            ? range(anchor, otherSide)
            : range(otherSide, anchor);
        props().selStore.set(next);
      };
      const onUp = () => {
        dragging = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    return {
      onMount() {
        recompute();
      },
      onUpdateAfter() {
        recompute();
      },
      render() {
        if (!isCoarsePointer()) return; // desktop — no handles
        const s = state.get();
        if (!s.start || !s.end) return;
        div(
          {
            class: "creo-handles",
            style:
              "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;",
          },
          () => {
            renderHandle("start", s.start!, onPointerDown("start"));
            renderHandle("end", s.end!, onPointerDown("end"));
          },
        );
        void _;
      },
    };
  },
);

function renderHandle(
  side: "start" | "end",
  dot: HandleDot,
  onDown: () => void,
): void {
  const cx = dot.left;
  const cy = dot.top + dot.height + 2;
  const dotPx = 12;
  div(
    {
      class: `creo-handle creo-handle-${side}`,
      key: side,
      // 44×44 touch target centered on the visual dot. pointer-events:auto
      // overrides the wrapper's pointer-events:none.
      style:
        `position:absolute;` +
        `left:${cx - HANDLE_SIZE / 2}px;` +
        `top:${cy - HANDLE_SIZE / 2}px;` +
        `width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;` +
        `pointer-events:auto;cursor:grab;` +
        `display:flex;align-items:center;justify-content:center;`,
      onPointerDown: onDown as never,
    } as never,
    () => {
      div({
        class: "creo-handle-dot",
        style:
          `width:${dotPx}px;height:${dotPx}px;` +
          `background:rgba(64,128,255,0.95);` +
          `border:2px solid white;` +
          `border-radius:50%;` +
          `box-shadow:0 1px 3px rgba(0,0,0,0.3);`,
      });
    },
  );
}

function anchorToDot(
  root: HTMLElement,
  doc: DocState,
  anchor: Anchor,
): HandleDot | null {
  const block = getBlock(doc, anchor.blockId);
  if (!block) return null;
  const offset = isTextBearing(block) ? anchorOffset(anchor) : 0;
  const el = findBlockElement(root, anchor.blockId);
  if (!el) return null;
  const rect = measureCaretRect(el, offset, root);
  if (!rect) return null;
  return { left: rect.left, top: rect.top, height: rect.height };
}

function sameState(a: State, b: State): boolean {
  if (a === b) return true;
  if ((a.start == null) !== (b.start == null)) return false;
  if ((a.end == null) !== (b.end == null)) return false;
  return (
    sameDot(a.start, b.start) &&
    sameDot(a.end, b.end)
  );
}
function sameDot(a: HandleDot | null, b: HandleDot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.left === b.left && a.top === b.top && a.height === b.height;
}

// Re-export to silence "value imported but never used" lint warnings when
// downstream code only consumes the view.
export { caret };
