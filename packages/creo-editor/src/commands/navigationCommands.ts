import type { Store } from "creo";
import {
  blockAbove,
  blockBelow,
  endOfBlock,
  endOfDocAnchor,
  homeOfBlock,
  homeOfDoc,
  nextAnchor,
  nextWord,
  prevAnchor,
  prevWord,
} from "../controller/navigation";
import {
  caret,
  range,
  selectionEnd,
  selectionStart,
} from "../controller/selection";
import type { Anchor, DocState, Selection } from "../model/types";

export type NavStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type AnchorStep = (doc: DocState, a: Anchor) => Anchor;

/**
 * Move the cursor by applying `step` to the current focus side.
 *  - `extend === false` → collapse to the new anchor.
 *  - `extend === true`  → keep the original anchor, move the focus.
 */
export function moveBy(
  { docStore, selStore }: NavStores,
  step: AnchorStep,
  extend: boolean,
): void {
  const doc = docStore.get();
  const sel = selStore.get();
  const focus = step(doc, selectionEnd(sel));
  if (!extend) {
    selStore.set(caret(focus));
    return;
  }
  const anchor = selectionStart(sel);
  if (sameAnchor(anchor, focus)) {
    selStore.set(caret(focus));
  } else {
    selStore.set(range(anchor, focus));
  }
}

export function moveTo(
  { selStore }: NavStores,
  anchor: Anchor,
  extend: boolean,
): void {
  if (!extend) {
    selStore.set(caret(anchor));
    return;
  }
  const cur = selStore.get();
  const start = selectionStart(cur);
  if (sameAnchor(start, anchor)) {
    selStore.set(caret(anchor));
  } else {
    selStore.set(range(start, anchor));
  }
}

function sameAnchor(a: Anchor, b: Anchor): boolean {
  if (a.blockId !== b.blockId) return false;
  if (a.path.length !== b.path.length) return false;
  for (let i = 0; i < a.path.length; i++) {
    if (a.path[i] !== b.path[i]) return false;
  }
  return true;
}

// Pre-bound steppers for keymap convenience.
export const STEP = {
  next: nextAnchor,
  prev: prevAnchor,
  nextWord,
  prevWord,
  up: blockAbove,
  down: blockBelow,
  home: homeOfBlock,
  end: endOfBlock,
  docHome: (doc: DocState, _a: Anchor) => homeOfDoc(doc),
  docEnd: (doc: DocState, _a: Anchor) => endOfDocAnchor(doc),
} satisfies Record<string, AnchorStep>;
