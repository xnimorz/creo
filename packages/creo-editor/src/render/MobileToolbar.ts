import { _ } from "creo";
import { button, div, view } from "creo";
import type { Store } from "creo";
import { isCoarsePointer } from "../input/mobile";
import { isTextBearing } from "../model/blockText";
import { getBlock } from "../model/doc";
import {
  anchorOffset,
  orderedRange,
  selectionStart,
} from "../controller/selection";
import type { Anchor, DocState, Selection } from "../model/types";
import { findBlockElement, measureCaretRect } from "./measure";

/**
 * Mobile floating toolbar — appears above a non-collapsed range (or above
 * the caret right after a long-press). Replaces the OS-native action menu
 * we lose by not being contentEditable.
 *
 * Buttons are wired to the editor's command dispatch so the toolbar stays a
 * pure view (no separate state machine).
 */

export type MobileToolbarProps = {
  editorId: string;
  selStore: Store<Selection>;
  docStore: Store<DocState>;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => Promise<void>;
  onSelectAll: () => void;
  onBold: () => void;
  onItalic: () => void;
};

type Pos = { left: number; top: number; visible: boolean };

const HIDDEN: Pos = { left: 0, top: 0, visible: false };

export const MobileToolbar = view<MobileToolbarProps>(({ props, use }) => {
  const sel = use(props().selStore);
  const doc = use(props().docStore);
  const pos = use<Pos>(HIDDEN);

  const recompute = () => {
    if (!isCoarsePointer()) {
      if (pos.get().visible) pos.set(HIDDEN);
      return;
    }
    const root = document.querySelector(
      `[data-creo-editor="${props().editorId}"]`,
    ) as HTMLElement | null;
    if (!root) {
      pos.set(HIDDEN);
      return;
    }
    const next = computePos(root, doc.get(), sel.get());
    if (samePos(pos.get(), next)) return;
    pos.set(next);
  };

  return {
    onMount() {
      recompute();
    },
    onUpdateAfter() {
      recompute();
    },
    render() {
      // Always emit the wrapper div — even when hidden — so the engine's
      // reconciler sees stable children. An earlier version returned early
      // when not visible and that confused the dirty-propagation path:
      // future range-selection updates wouldn't trigger a re-render
      // because the previous render produced no children at all.
      const p = pos.get();
      const visStyle = p.visible
        ? `display:flex;left:${p.left}px;top:${p.top}px;`
        : "display:none;left:0;top:0;";
      div(
        {
          class: p.visible
            ? "creo-mobile-toolbar"
            : "creo-mobile-toolbar creo-mobile-toolbar-hidden",
          style:
            `position:absolute;${visStyle}` +
            `transform:translate(-50%,-100%) translateY(-8px);` +
            `gap:4px;padding:6px 8px;` +
            `background:#222;color:white;border-radius:6px;` +
            `box-shadow:0 2px 8px rgba(0,0,0,0.3);` +
            `font-size:14px;line-height:1;z-index:100;`,
        },
        () => {
          tbBtn("Cut", props().onCut);
          tbBtn("Copy", props().onCopy);
          tbBtn("Paste", () => void props().onPaste());
          tbBtn("All", props().onSelectAll);
          tbBtn("B", props().onBold);
          tbBtn("I", props().onItalic);
        },
      );
      void _;
    },
  };
});

function tbBtn(label: string, onClick: () => void): void {
  button(
    {
      class: "creo-tb-btn",
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      },
      style:
        "background:transparent;color:white;border:0;" +
        "min-width:32px;min-height:32px;cursor:pointer;font-weight:600;",
    },
    label,
  );
}

function computePos(
  root: HTMLElement,
  doc: DocState,
  sel: Selection,
): Pos {
  if (sel.kind === "caret") return HIDDEN;
  const { start, end } = orderedRange(doc, sel);
  // Anchor the toolbar above the visual midpoint of the start anchor.
  const anchor = midAnchor(start, end);
  const block = getBlock(doc, anchor.blockId);
  if (!block || !isTextBearing(block)) return HIDDEN;
  const el = findBlockElement(root, anchor.blockId);
  if (!el) return HIDDEN;
  const rect = measureCaretRect(el, anchorOffset(anchor), root);
  if (!rect) return HIDDEN;
  return { left: rect.left, top: rect.top, visible: true };
}

function midAnchor(a: Anchor, b: Anchor): Anchor {
  // Cheap "middle" approximation: pick the anchor with the smaller offset
  // (avoids cross-block offset arithmetic for v1).
  if (a.blockId !== b.blockId) return selectionStart({ kind: "range", anchor: a, focus: b });
  const ao = anchorOffset(a);
  const bo = anchorOffset(b);
  const mid = Math.floor((ao + bo) / 2);
  return { ...a, path: a.path.length >= 3 ? [a.path[0]!, a.path[1]!, mid] : [mid], offset: mid };
}

function samePos(a: Pos, b: Pos): boolean {
  return a.visible === b.visible && a.left === b.left && a.top === b.top;
}
