import type { Store } from "creo";
import type { DocState, Selection } from "../model/types";
import { caret } from "../controller/selection";
import { pointToAnchor } from "../render/measure";

// ---------------------------------------------------------------------------
// Coarse-pointer detection — true on phones / tablets, false on desktop.
// Runtime-checked once and cached.
// ---------------------------------------------------------------------------

let __coarsePointer: boolean | null = null;
export function isCoarsePointer(): boolean {
  if (__coarsePointer != null) return __coarsePointer;
  if (typeof window === "undefined" || !window.matchMedia) {
    __coarsePointer = false;
    return false;
  }
  __coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  return __coarsePointer;
}

/** Test-only override (clears the cache so the next read re-detects). */
export function __resetCoarsePointerCache(): void {
  __coarsePointer = null;
}

// ---------------------------------------------------------------------------
// Visual viewport tracking
//
// When the soft keyboard opens, iOS shrinks the *visual* viewport without
// changing the *layout* viewport. We listen to `visualViewport.resize` and
// keep the editor's caret block in the upper third of whatever space is
// still visible.
// ---------------------------------------------------------------------------

export type ViewportStores = {
  selStore: Store<Selection>;
  docStore: Store<DocState>;
};

export type ViewportHandle = { destroy: () => void };

export function attachVisualViewport(
  root: HTMLElement,
  stores: ViewportStores,
): ViewportHandle {
  if (typeof window === "undefined") return { destroy: () => {} };
  const vv = (window as Window & {
    visualViewport?: VisualViewport;
  }).visualViewport;
  if (!vv) return { destroy: () => {} };

  const apply = () => {
    // Available height is the visual viewport — when the soft keyboard is
    // up, this shrinks. We expose it as a CSS custom property so the host
    // can use it (e.g., max-height) without explicit code paths.
    root.style.setProperty("--creo-vv-height", `${vv.height}px`);
    root.style.setProperty("--creo-vv-top", `${vv.offsetTop}px`);
    scrollCaretIntoUpperThird(root, stores);
  };

  apply();
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);

  return {
    destroy() {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    },
  };
}

function scrollCaretIntoUpperThird(
  root: HTMLElement,
  stores: ViewportStores,
): void {
  const sel = stores.selStore.get();
  const at = sel.kind === "caret" ? sel.at : sel.focus;
  const blockEl = root.querySelector(
    `[data-block-id="${at.blockId.replace(/"/g, '\\"')}"]`,
  ) as HTMLElement | null;
  if (!blockEl) return;
  const rect = blockEl.getBoundingClientRect();
  const vv = (window as Window & { visualViewport?: VisualViewport })
    .visualViewport;
  if (!vv) return;
  const vvTop = vv.offsetTop;
  const vvBottom = vvTop + vv.height;
  // If the block is within the visible portion already, do nothing.
  if (rect.top >= vvTop && rect.bottom <= vvBottom) return;
  // Otherwise scroll so the block sits in the upper-third zone.
  const desiredTop = vvTop + vv.height / 3;
  const dy = rect.top - desiredTop;
  // Find a scrollable ancestor (default to window).
  const scrollEl = findScrollableAncestor(root);
  if (scrollEl === window) {
    window.scrollTo({ top: window.scrollY + dy, behavior: "smooth" });
  } else {
    (scrollEl as HTMLElement).scrollTop += dy;
  }
}

function findScrollableAncestor(el: HTMLElement): HTMLElement | Window {
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = window.getComputedStyle(cur);
    if (
      /(auto|scroll|overlay)/.test(
        style.overflowY + style.overflowX + style.overflow,
      )
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return window;
}

// ---------------------------------------------------------------------------
// Tap / scroll / long-press classifier
//
// The whole point: never call preventDefault() on touchstart unless we've
// classified the gesture as a long-press. That preserves native scrolling.
// ---------------------------------------------------------------------------

export type TouchClassifierStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type TouchClassifierOptions = {
  onTap?: (anchor: ReturnType<typeof pointToAnchor>) => void;
  onLongPress?: (x: number, y: number) => void;
  /** Called on tap so the caller can pull up the keyboard. */
  focusInput?: () => void;
};

export type TouchClassifierHandle = { destroy: () => void };

const MOVE_THRESHOLD_PX = 8;
const TAP_TIMEOUT_MS = 250;
const LONG_PRESS_MS = 500;

export function attachTouchClassifier(
  root: HTMLElement,
  stores: TouchClassifierStores,
  opts: TouchClassifierOptions = {},
): TouchClassifierHandle {
  let startX = 0;
  let startY = 0;
  let startedAt = 0;
  let active = false;
  let moved = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupTimer = () => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onPointerDown = (e: Event) => {
    const ev = e as PointerEvent;
    // Only handle the primary pointer.
    if (ev.isPrimary === false) return;
    active = true;
    moved = false;
    startX = ev.clientX;
    startY = ev.clientY;
    startedAt = Date.now();
    cleanupTimer();
    longPressTimer = setTimeout(() => {
      if (!active || moved) return;
      // Long press fired — vibrate (best-effort) and notify.
      const nav = (navigator as { vibrate?: (n: number) => void });
      try {
        nav.vibrate?.(10);
      } catch {
        // Ignore — vibrate isn't allowed without a recent user gesture on
        // some browsers.
      }
      opts.onLongPress?.(startX, startY);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: Event) => {
    if (!active) return;
    const ev = e as PointerEvent;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (dx * dx + dy * dy >= MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
      moved = true;
      cleanupTimer();
    }
  };

  const onPointerUp = (e: Event) => {
    if (!active) return;
    const ev = e as PointerEvent;
    active = false;
    cleanupTimer();
    const dt = Date.now() - startedAt;
    if (!moved && dt < TAP_TIMEOUT_MS) {
      // Classified as a tap.
      opts.focusInput?.();
      const anchor = pointToAnchor(
        stores.docStore.get(),
        root,
        ev.clientX,
        ev.clientY,
      );
      opts.onTap?.(anchor);
      if (anchor) stores.selStore.set(caret(anchor));
    }
  };

  const onPointerCancel = () => {
    active = false;
    cleanupTimer();
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerCancel);

  return {
    destroy() {
      cleanupTimer();
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
    },
  };
}

// Test-only constants for the gesture classifier (so unit tests don't have
// to wait the real 500ms).
export const __testTimings = {
  MOVE_THRESHOLD_PX,
  TAP_TIMEOUT_MS,
  LONG_PRESS_MS,
};

// ---------------------------------------------------------------------------
// Caret-following textarea position
// ---------------------------------------------------------------------------

/**
 * Move the hidden textarea so it sits at the caret. iOS Safari scrolls
 * focused inputs into view; positioning the textarea AT the caret means the
 * scroll-into-view points at the right place.
 *
 * Called by the caret overlay each time the selection or document changes
 * (so we don't need a second measurement loop).
 */
export function moveTextareaToCaret(
  textarea: HTMLTextAreaElement | null,
  caretLeft: number,
  caretTop: number,
): void {
  if (!textarea) return;
  textarea.style.top = `${Math.max(0, caretTop)}px`;
  textarea.style.left = `${Math.max(0, caretLeft)}px`;
}
