import type { Store } from "creo";
import type { DocState, Selection } from "../model/types";
import {
  deleteBackward,
  deleteForward,
  insertText,
} from "../commands/textCommands";
import { moveBy, moveTo, STEP } from "../commands/navigationCommands";
import {
  selectionEnd,
  selectionStart,
  caret as caretSel,
  range as rangeSel,
} from "../controller/selection";
import { isTextBearing } from "../model/blockText";
import { getBlock } from "../model/doc";
import { findBlockElement, measureCaretRect, pointToAnchorByVisualLine } from "../render/measure";
import type { Anchor } from "../model/types";
import {
  mergeBackward,
  mergeForward,
  setBlockType,
  splitBlock,
} from "../commands/structuralCommands";
import { toggleMark } from "../commands/markCommands";
import { deleteSelectedImage } from "../commands/imageCommands";
import { indentList, outdentList } from "../commands/listCommands";
import {
  isInTable,
  tableNextCell,
  tablePrevCell,
} from "../commands/tableCommands";
import { matchKeymap } from "./keymap";

export type PipelineStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type PipelineOptions = {
  /**
   * Called BEFORE every mutation with a tag describing the action. The
   * editor wires this to its history controller so undo/redo coalesces
   * keystroke chains correctly.
   */
  record?: (tag: string) => void;
  undo?: () => void;
  redo?: () => void;
  selectAll?: () => void;
  /**
   * Returns the editor root element for measurement-based navigation.
   * Optional — if missing, vertical motion falls back to block-jumps.
   */
  rootForMeasure?: () => HTMLElement | null;
};

export type PipelineHandle = {
  /** Detach all listeners. */
  destroy: () => void;
  /** Force the textarea to take focus. */
  focus: () => void;
  blur: () => void;
};

/**
 * Wire the canonical input pipeline to a textarea: `beforeinput` →
 * commands. Composition events are tracked but, per the design, do NOT
 * mutate the document until `compositionend` (this avoids Gboard /
 * QuickType swipe-typing producing intermediate gibberish).
 *
 * Each event handler short-circuits when the inputType is something we
 * haven't wired yet — later milestones extend the switch.
 */
export function attachInputPipeline(
  textarea: HTMLTextAreaElement,
  stores: PipelineStores,
  options: PipelineOptions = {},
): PipelineHandle {
  let composing = false;
  let lastCompositionData = "";
  const record = (tag: string) => options.record?.(tag);
  // "Goal column" for vertical motion. We remember the X pixel column the
  // caret was at when the user started moving up/down, and snap to it on
  // each subsequent up/down. Reset by any horizontal motion or text edit.
  let goalX: number | null = null;
  const resetGoalX = () => {
    goalX = null;
  };
  const verticalMove = (direction: -1 | 1, extend: boolean) => {
    const root = options.rootForMeasure?.() ?? null;
    if (!root) {
      // No measurement available — block-jump fallback.
      moveBy(stores, direction < 0 ? STEP.up : STEP.down, extend);
      return;
    }
    const sel = stores.selStore.get();
    const focus: Anchor = selectionEnd(sel);
    const focusBlock = getBlock(stores.docStore.get(), focus.blockId);
    if (!focusBlock) return;
    const blockEl = findBlockElement(root, focus.blockId);
    if (!blockEl) {
      moveBy(stores, direction < 0 ? STEP.up : STEP.down, extend);
      return;
    }
    // For tables, anchor the measurement against the cell <td>, not the
    // <table>, so the line-stepping math works inside cells.
    let measureEl: HTMLElement = blockEl;
    let offsetForRect = 0;
    if (focusBlock.type === "table") {
      const r = focus.path[0] ?? 0;
      const c = focus.path[1] ?? 0;
      const td = blockEl.querySelector(
        `td[data-cell="${r}:${c}"]`,
      ) as HTMLElement | null;
      if (td) {
        measureEl = td;
        offsetForRect = focus.path[2] ?? 0;
      }
    } else if (isTextBearing(focusBlock)) {
      offsetForRect = focus.path[0] ?? 0;
    }
    const rect = measureCaretRect(measureEl, offsetForRect, root);
    if (!rect) {
      moveBy(stores, direction < 0 ? STEP.up : STEP.down, extend);
      return;
    }
    if (goalX == null) goalX = rect.left;
    const target = pointToAnchorByVisualLine(
      stores.docStore.get(),
      root,
      rect,
      goalX,
      direction,
    );
    if (!target) {
      // Out of doc edge — fall back to block jump (which clamps).
      moveBy(stores, direction < 0 ? STEP.up : STEP.down, extend);
      return;
    }
    if (extend) {
      const anchor = selectionStart(sel);
      stores.selStore.set(rangeSel(anchor, target));
    } else {
      stores.selStore.set(caretSel(target));
    }
  };

  const onBeforeInput = (e: Event) => {
    const ev = e as InputEvent;
    if (composing) {
      // Browsers fire beforeinput during composition; the actual character
      // commit comes via `compositionend`. Skip everything here.
      return;
    }
    const data = (ev as InputEvent).data ?? "";
    const inputType = (ev as InputEvent).inputType ?? "";

    switch (inputType) {
      case "insertText":
      case "insertReplacementText":
      case "insertFromYank":
      case "insertFromDrop":
      case "insertFromPaste":
        if (data.length) {
          ev.preventDefault();
          record("text:insert");
          resetGoalX();
          insertText(stores, data);
        }
        return;

      case "insertParagraph":
      case "insertLineBreak":
        ev.preventDefault();
        record("splitBlock");
        splitBlock(stores);
        return;

      case "deleteContentBackward":
      case "deleteWordBackward":
      case "deleteSoftLineBackward":
      case "deleteHardLineBackward":
        ev.preventDefault();
        record("text:deleteBack");
        // Try in-block delete; if that no-ops (caret at offset 0), fall back
        // to a block merge — and finally to image-block deletion.
        if (!deleteBackward(stores)) {
          if (!mergeBackward(stores)) deleteSelectedImage(stores);
        }
        return;

      case "deleteContentForward":
      case "deleteWordForward":
      case "deleteSoftLineForward":
      case "deleteHardLineForward":
        ev.preventDefault();
        record("text:deleteFwd");
        if (!deleteForward(stores)) mergeForward(stores);
        return;

      // Other inputType values (formatBold, historyUndo, ...) are wired in
      // their dedicated milestones.
      default:
        return;
    }
  };

  const onCompositionStart = () => {
    composing = true;
    lastCompositionData = "";
  };

  const onCompositionUpdate = (e: Event) => {
    const ev = e as CompositionEvent;
    lastCompositionData = ev.data ?? "";
  };

  const onCompositionEnd = (e: Event) => {
    composing = false;
    const ev = e as CompositionEvent;
    const data = ev.data ?? lastCompositionData;
    lastCompositionData = "";
    // Reset the textarea so it doesn't accumulate the IME committed text
    // (we render our own document — the textarea is just an event source).
    textarea.value = "";
    if (data.length) {
      record("text:insert");
      insertText(stores, data);
    }
  };

  const onKeyDown = (e: Event) => {
    const ev = e as KeyboardEvent;
    if (composing) return;

    // Chord match first — covers Cmd+B, Cmd+Z, Cmd+Alt+1.., Tab, Shift+Tab.
    const hit = matchKeymap(ev);
    if (hit) {
      ev.preventDefault();
      switch (hit.kind) {
        case "toggleMark":
          record(`mark:${hit.mark}`);
          toggleMark(stores, hit.mark);
          return;
        case "setBlockType":
          record(`setBlockType:${hit.payload.type}`);
          setBlockType(stores, hit.payload);
          return;
        case "indent":
          if (isInTable(stores.docStore.get(), stores.selStore.get())) {
            tableNextCell(stores);
          } else {
            record("indent");
            indentList(stores);
          }
          return;
        case "outdent":
          if (isInTable(stores.docStore.get(), stores.selStore.get())) {
            tablePrevCell(stores);
          } else {
            record("outdent");
            outdentList(stores);
          }
          return;
        case "undo":
          options.undo?.();
          return;
        case "redo":
          options.redo?.();
          return;
        case "selectAll":
          options.selectAll?.();
          return;
        case "moveWord":
          resetGoalX();
          moveBy(
            stores,
            hit.direction < 0 ? STEP.prevWord : STEP.nextWord,
            hit.extend,
          );
          return;
        case "moveLineEdge":
          resetGoalX();
          moveBy(
            stores,
            hit.direction < 0 ? STEP.home : STEP.end,
            hit.extend,
          );
          return;
        case "moveDocEdge":
          resetGoalX();
          moveBy(
            stores,
            hit.direction < 0 ? STEP.docHome : STEP.docEnd,
            hit.extend,
          );
          return;
      }
    }

    const extend = ev.shiftKey === true;
    switch (ev.key) {
      case "ArrowLeft":
        ev.preventDefault();
        resetGoalX();
        moveBy(stores, STEP.prev, extend);
        return;
      case "ArrowRight":
        ev.preventDefault();
        resetGoalX();
        moveBy(stores, STEP.next, extend);
        return;
      case "ArrowUp":
        // Visual-line aware: snap to the goalX column on the visual line
        // immediately above. Falls back to a block-jump when measurement
        // isn't available (headless / no layout).
        ev.preventDefault();
        verticalMove(-1, extend);
        return;
      case "ArrowDown":
        ev.preventDefault();
        verticalMove(1, extend);
        return;
      case "Home":
        ev.preventDefault();
        moveBy(
          stores,
          ev.metaKey || ev.ctrlKey ? STEP.docHome : STEP.home,
          extend,
        );
        return;
      case "End":
        ev.preventDefault();
        moveBy(
          stores,
          ev.metaKey || ev.ctrlKey ? STEP.docEnd : STEP.end,
          extend,
        );
        return;
      case "Enter":
        // beforeinput's insertParagraph is the canonical path; the keydown
        // path covers tests and any browser that doesn't fire beforeinput.
        ev.preventDefault();
        record("splitBlock");
        splitBlock(stores);
        return;
      case "Backspace":
        ev.preventDefault();
        record("text:deleteBack");
        if (!deleteBackward(stores)) {
          if (!mergeBackward(stores)) deleteSelectedImage(stores);
        }
        return;
      case "Delete":
        ev.preventDefault();
        record("text:deleteFwd");
        if (!deleteForward(stores)) mergeForward(stores);
        return;
    }
  };

  textarea.addEventListener("beforeinput", onBeforeInput);
  textarea.addEventListener("compositionstart", onCompositionStart);
  textarea.addEventListener("compositionupdate", onCompositionUpdate);
  textarea.addEventListener("compositionend", onCompositionEnd);
  textarea.addEventListener("keydown", onKeyDown);

  return {
    destroy() {
      textarea.removeEventListener("beforeinput", onBeforeInput);
      textarea.removeEventListener("compositionstart", onCompositionStart);
      textarea.removeEventListener("compositionupdate", onCompositionUpdate);
      textarea.removeEventListener("compositionend", onCompositionEnd);
      textarea.removeEventListener("keydown", onKeyDown);
    },
    focus() {
      // preventScroll: true — iOS aggressively scrolls focused inputs into
      // view; we do our own scroll-into-view on selection change.
      textarea.focus({ preventScroll: true } as FocusOptions);
    },
    blur() {
      textarea.blur();
    },
  };
}
