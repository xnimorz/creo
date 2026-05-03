import type { Anchor, BlockId, DocState } from "../model/types";
import { isTextBearing, type TextBearingBlock } from "../model/blockText";
import { getBlock } from "../model/doc";
import { anchorOffset, caretAt } from "../controller/selection";

// ---------------------------------------------------------------------------
// Block element lookup
// ---------------------------------------------------------------------------

export function findBlockElement(
  root: HTMLElement | Document,
  blockId: BlockId,
): HTMLElement | null {
  return (root as HTMLElement | Document).querySelector(
    `[data-block-id="${cssEscape(blockId)}"]`,
  ) as HTMLElement | null;
}

function cssEscape(s: string): string {
  // Block ids are alphanum + underscore, but be safe.
  return s.replace(/(["\\])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// Text-node walking
// ---------------------------------------------------------------------------

/**
 * Walk the descendant text nodes of `blockEl` (in document order) and find
 * the one that contains the `offset`-th character. Returns the local offset
 * inside that text node.
 *
 * Important: text nodes wrapped by mark elements (em/strong/u/s/code) are
 * traversed too — we only count visible characters. The placeholder
 * zero-width-space inserted into empty runs counts as 0 here, so the caret
 * snaps to a placeholder in an empty paragraph.
 */
const ZWSP = "​";

export type TextHit = {
  node: Text;
  localOffset: number;
};

export function findTextNodeAtOffset(
  blockEl: HTMLElement,
  offset: number,
): TextHit | null {
  let remaining = offset;
  let last: TextHit | null = null;

  const walk = (node: Node): TextHit | null => {
    if (node.nodeType === 3) {
      const text = node as Text;
      const data = text.data;
      // Skip placeholder zero-width-space — it's purely visual.
      const len = data === ZWSP ? 0 : data.length;
      if (remaining <= len) {
        return { node: text, localOffset: remaining };
      }
      remaining -= len;
      last = { node: text, localOffset: data === ZWSP ? 0 : data.length };
      return null;
    }
    for (const child of Array.from(node.childNodes)) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  };

  const direct = walk(blockEl);
  return direct ?? last;
}

// ---------------------------------------------------------------------------
// Caret / selection rect measurement
// ---------------------------------------------------------------------------

export type CaretRect = {
  left: number; // editor-local px
  top: number;
  height: number;
};

/**
 * Measure the caret at `offset` inside `blockEl`. Returns coordinates
 * relative to `referenceEl` (typically the editor root or the overlay
 * container — both must share a positioning context).
 *
 * Returns null when measurement is unavailable (no layout, headless tests).
 */
export function measureCaretRect(
  blockEl: HTMLElement,
  offset: number,
  referenceEl: HTMLElement,
): CaretRect | null {
  const hit = findTextNodeAtOffset(blockEl, offset);
  const range = document.createRange();
  try {
    if (hit) {
      // Clamp local offset to the node's data length.
      const max = hit.node.data.length;
      const o = Math.max(0, Math.min(max, hit.localOffset));
      range.setStart(hit.node, o);
      range.setEnd(hit.node, o);
    } else {
      // No text inside the block — collapse at the block element.
      range.selectNodeContents(blockEl);
      range.collapse(true);
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && rect.top === 0) {
      // Headless / no layout — fall back to block element rect.
      const bRect = blockEl.getBoundingClientRect();
      const refRect = referenceEl.getBoundingClientRect();
      if (bRect.width === 0 && bRect.height === 0) return null;
      return {
        left: bRect.left - refRect.left,
        top: bRect.top - refRect.top,
        height: bRect.height || 16,
      };
    }
    const refRect = referenceEl.getBoundingClientRect();
    return {
      left: rect.left - refRect.left,
      top: rect.top - refRect.top,
      height: rect.height || 16,
    };
  } finally {
    range.detach?.();
  }
}

export type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Measure all line-rectangles for a selection range that lies within a
 * single block. (Cross-block ranges are decomposed by the caller — we
 * concatenate per-block measurements.)
 */
export function measureSelectionRectsInBlock(
  blockEl: HTMLElement,
  startOffset: number,
  endOffset: number,
  referenceEl: HTMLElement,
): SelectionRect[] {
  if (startOffset === endOffset) return [];
  const startHit = findTextNodeAtOffset(blockEl, startOffset);
  const endHit = findTextNodeAtOffset(blockEl, endOffset);
  if (!startHit || !endHit) return [];
  const range = document.createRange();
  try {
    range.setStart(startHit.node, startHit.localOffset);
    range.setEnd(endHit.node, endHit.localOffset);
    const rects = Array.from(range.getClientRects());
    const refRect = referenceEl.getBoundingClientRect();
    return rects.map((r) => ({
      left: r.left - refRect.left,
      top: r.top - refRect.top,
      width: r.width,
      height: r.height,
    }));
  } finally {
    range.detach?.();
  }
}

// ---------------------------------------------------------------------------
// Pointer → anchor conversion
// ---------------------------------------------------------------------------

type CaretRangeAPI = (x: number, y: number) => Range | null;
type CaretPositionAPI = (
  x: number,
  y: number,
) => { offsetNode: Node; offset: number } | null;

/**
 * Decide whether a `caretFromPoint` hit accurately reflects where the user
 * clicked, or whether the browser fell back to "closest character" snapping
 * (which produces wrong-end-of-line behaviour when y is just above/below
 * the text's box).
 *
 * Heuristic: build a tight bounding box for the text node (or the offset
 * inside an element) and treat the hit as trustworthy iff the click point
 * lies within it (with ~2px slack for sub-pixel rounding).
 */
function hitIsTrustworthy(
  hit: { node: Node; offset: number },
  x: number,
  y: number,
): boolean {
  const range = document.createRange();
  try {
    if (hit.node.nodeType === 3) {
      range.selectNodeContents(hit.node);
    } else {
      // Element hit — bound by the element itself.
      range.selectNode(hit.node as Element);
    }
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const slack = 2;
    return (
      x >= r.left - slack &&
      x <= r.right + slack &&
      y >= r.top - slack &&
      y <= r.bottom + slack
    );
  } catch {
    return false;
  } finally {
    range.detach?.();
  }
}

function caretFromPoint(
  x: number,
  y: number,
): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretRangeFromPoint?: CaretRangeAPI;
    caretPositionFromPoint?: CaretPositionAPI;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) return { node: r.startContainer, offset: r.startOffset };
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const r = doc.caretPositionFromPoint(x, y);
    if (r) return { node: r.offsetNode, offset: r.offset };
  }
  return null;
}

/**
 * Find the nearest ancestor with `data-block-id` and translate (textNode,
 * localOffset) → block-relative char offset.
 */
function findOwningBlock(node: Node): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur.nodeType !== 1) cur = cur.parentNode;
  while (cur && cur.nodeType === 1) {
    const el = cur as HTMLElement;
    if (el.getAttribute("data-block-id")) return el;
    cur = el.parentElement;
  }
  return null;
}

/**
 * Convert a `(node, localOffset)` caret hit into a character offset within
 * `blockEl`'s visible text.
 *
 * Built around `Range`: a Range spanning [blockEl-start, hitNode:localOffset]
 * gives us the textual prefix as a string, and `length` minus the number
 * of ZWSP placeholders is the offset we want.
 *
 * Crucially this works whether the hit is on a Text node OR on an element
 * (e.g. when the user clicks on a `<li>`'s bullet, which is a CSS-marker
 * pseudo-element — the browser's `caretFromPoint` returns the `<li>` itself
 * with `offset = childIndex`). The previous text-walking implementation
 * silently returned the FULL length of the block in that case, planting
 * the caret at end-of-line instead of start-of-line.
 */
function offsetWithinBlock(
  blockEl: HTMLElement,
  hitNode: Node,
  localOffset: number,
): number {
  // If the hit is OUTSIDE the block (shouldn't happen, but be defensive)
  // fall back to 0 / max.
  if (!blockEl.contains(hitNode) && hitNode !== blockEl) {
    // Comparison: is hitNode before or after blockEl in document order?
    const cmp = blockEl.compareDocumentPosition(hitNode);
    if (cmp & Node.DOCUMENT_POSITION_FOLLOWING) {
      return visibleTextLength(blockEl);
    }
    return 0;
  }
  const range = document.createRange();
  try {
    range.selectNodeContents(blockEl);
    range.setEnd(hitNode, Math.max(0, localOffset));
    const text = range.toString();
    return text.replace(/​/g, "").length;
  } catch {
    // Some hit nodes (e.g. detached) throw on setEnd. Gracefully degrade.
    return 0;
  } finally {
    range.detach?.();
  }
}

function visibleTextLength(el: HTMLElement): number {
  let n = 0;
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = (node as Text).data;
      if (t !== ZWSP) n += t.length;
      return;
    }
    for (const c of Array.from(node.childNodes)) walk(c);
  };
  walk(el);
  return n;
}

/**
 * Convert a viewport-coordinate point to an editor anchor.
 *
 * Two-pass strategy:
 *
 *   1. Direct hit-test via `caretFromPoint`. Works whenever the pointer is
 *      over an actual text node (the common case).
 *
 *   2. Fallback: find the block whose vertical span contains `y` (or the
 *      closest one if `y` is below all blocks), clamp `x` to that block's
 *      bounding box, and re-query. This is what makes "click far to the
 *      right of a line lands the caret at end of line" work — the user's
 *      pointer wasn't over any text, but they clearly wanted to edit
 *      that line. Standard editor UX.
 *
 *   3. If the clamped re-query still fails (e.g. an empty paragraph with
 *      only a placeholder), return an end-of-block anchor as a final
 *      sanity-net so clicks inside the editor are never silently dropped.
 *
 * Returns null only when the editor genuinely contains no blocks.
 */
export function pointToAnchor(
  doc: DocState,
  root: HTMLElement,
  x: number,
  y: number,
): Anchor | null {
  // Pass 1 — direct hit.
  //
  // We only TRUST a Pass 1 hit when the click point is inside the bounding
  // rect of the resolved text node. Otherwise the browser silently snapped
  // to the closest character — which Chromium computes as offset 0 at the
  // top edge of a text line. That makes "click slightly above a row, far
  // to the right" land at start-of-row instead of end-of-row. By validating
  // the rect, we let those cases fall through to the clamped Pass 2.
  const direct = caretFromPoint(x, y);
  if (direct && hitIsTrustworthy(direct, x, y)) {
    const a = resolveFromCaretHit(doc, direct);
    if (a) return a;
  }

  // Pass 2 — clamped fallback.
  const blockEl = findBlockAtY(root, y);
  if (!blockEl) return null;
  const rect = blockEl.getBoundingClientRect();
  const blockId = blockEl.getAttribute("data-block-id");
  if (!blockId) return null;

  // Click is BELOW its closest block AND that block is the LAST visible
  // one in the editor — standard editor convention: jump to end-of-doc
  // instead of projecting X onto the last line. We require "is last"
  // because for blocks that aren't last, "below" means we're in the gap
  // between them and the next block, where clamping into the closest
  // block's last line is the right answer.
  if (y > rect.bottom && isLastBlock(root, blockEl)) {
    return endOfBlockAnchor(doc, blockId);
  }
  // Symmetric case for clicks above the FIRST block.
  if (y < rect.top && isFirstBlock(root, blockEl)) {
    if (isTextBearing(getBlock(doc, blockId)!)) {
      return caretAt(blockId, 0);
    }
    // Non-text first block — fall through to clamping below.
  }

  // Otherwise: snap into the closest line by clamping y past the block's
  // edge and re-querying. The Y inset matters: caretFromPoint at the
  // exact top/bottom edge is browser-dependent and Chromium snaps to
  // offset 0 at the top edge — that's the bug that turned "click slightly
  // above row N, far right" into "start of row N" instead of "end".
  const inset = Math.min(8, Math.max(2, rect.height / 4));
  const cx = Math.max(rect.left + 1, Math.min(rect.right - 1, x));
  const cy = Math.max(
    rect.top + inset,
    Math.min(rect.bottom - inset, y),
  );
  const clamped = caretFromPoint(cx, cy);
  if (clamped) {
    const a = resolveFromCaretHit(doc, clamped);
    if (a) return a;
  }

  // Pass 3 — block-end sanity-net.
  return endOfBlockAnchor(doc, blockId);
}

function resolveFromCaretHit(
  doc: DocState,
  caret: { node: Node; offset: number },
): Anchor | null {
  const blockEl = findOwningBlock(caret.node);
  if (!blockEl) return null;
  const blockId = blockEl.getAttribute("data-block-id");
  if (!blockId) return null;
  const block = getBlock(doc, blockId);
  if (!block) return null;
  if (isTextBearing(block)) {
    const off = offsetWithinBlock(blockEl, caret.node, caret.offset);
    return caretAt(blockId, off);
  }
  if (block.type === "table") {
    const td = findOwningCell(caret.node);
    if (td) {
      const cellAttr = td.getAttribute("data-cell");
      if (cellAttr) {
        const [rs, cs] = cellAttr.split(":");
        const r = Number(rs);
        const c = Number(cs);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          const off = offsetWithinBlock(td, caret.node, caret.offset);
          return { blockId, path: [r, c, off], offset: off };
        }
      }
    }
    return { blockId, path: [0, 0, 0], offset: 0 };
  }
  if (block.type === "columns") {
    const colEl = findOwningCol(caret.node);
    if (colEl) {
      const ci = Number(colEl.getAttribute("data-col"));
      if (Number.isFinite(ci)) {
        const off = offsetWithinBlock(colEl, caret.node, caret.offset);
        return { blockId, path: [ci, off], offset: off };
      }
    }
    return { blockId, path: [0, 0], offset: 0 };
  }
  // Images: coarse anchor.
  return { blockId, path: [0], offset: 0 };
}

/**
 * Find the top-level `.ce-block` whose vertical bounding box contains `y`.
 *
 * When `y` is OUTSIDE every block (in the gap between two blocks, in the
 * editor's top/bottom padding, etc.) we pick the block with the smallest
 * vertical-edge distance. That's the closest one the user could plausibly
 * have meant to click — clicking 2px above row N should still target row
 * N, not the row above it.
 *
 * Returns null only when the editor contains no blocks.
 */
function findBlockAtY(root: HTMLElement, y: number): HTMLElement | null {
  const blocks = root.querySelectorAll(
    "[data-block-id].ce-block",
  ) as NodeListOf<HTMLElement>;
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const el of Array.from(blocks)) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    if (y >= rect.top && y <= rect.bottom) return el; // direct hit
    const dist = y < rect.top ? rect.top - y : y - rect.bottom;
    if (dist < bestDist) {
      best = el;
      bestDist = dist;
    }
  }
  return best;
}

function isFirstBlock(root: HTMLElement, el: HTMLElement): boolean {
  const blocks = root.querySelectorAll(
    "[data-block-id].ce-block",
  ) as NodeListOf<HTMLElement>;
  for (const b of Array.from(blocks)) {
    if (b.getBoundingClientRect().height === 0) continue;
    return b === el;
  }
  return false;
}

function isLastBlock(root: HTMLElement, el: HTMLElement): boolean {
  const blocks = Array.from(
    root.querySelectorAll("[data-block-id].ce-block"),
  ) as HTMLElement[];
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]!.getBoundingClientRect().height === 0) continue;
    return blocks[i] === el;
  }
  return false;
}

/** End-of-block anchor — used when even the clamped re-query fails. */
function endOfBlockAnchor(doc: DocState, blockId: string): Anchor | null {
  const block = getBlock(doc, blockId);
  if (!block) return null;
  if (isTextBearing(block)) {
    let len = 0;
    for (const r of (block as TextBearingBlock).runs) len += r.text.length;
    return caretAt(blockId, len);
  }
  if (block.type === "img") return { blockId, path: [1], offset: 1 };
  if (block.type === "columns") {
    const last = block.cols - 1;
    const cell = block.cells[last] ?? [];
    let len = 0;
    for (const r of cell) len += r.text.length;
    return { blockId, path: [last, len], offset: len };
  }
  // table — bottom-right cell, end of cell text.
  const r = block.rows - 1;
  const c = block.cols - 1;
  const cell = block.cells[r]?.[c] ?? [];
  let len = 0;
  for (const run of cell) len += run.text.length;
  return { blockId, path: [r, c, len], offset: len };
}

function findOwningCol(node: Node): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur.nodeType !== 1) cur = cur.parentNode;
  while (cur && cur.nodeType === 1) {
    const el = cur as HTMLElement;
    if (el.getAttribute("data-col") != null) return el;
    cur = el.parentElement;
  }
  return null;
}

function findOwningCell(node: Node): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur.nodeType !== 1) cur = cur.parentNode;
  while (cur && cur.nodeType === 1) {
    const el = cur as HTMLElement;
    if (el.tagName.toLowerCase() === "td" && el.getAttribute("data-cell")) {
      return el;
    }
    cur = el.parentElement;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Visual-line navigation via caret measurement
//
// `pointToAnchorByVisualLine` walks one visual line up/down from the
// reference rect, snapping to a target column. The caller stores the
// "goal column" between consecutive vertical motions so a sequence of
// ArrowDown presses through wide-then-narrow lines doesn't drift.
// ---------------------------------------------------------------------------

const LINE_HEIGHT_FALLBACK = 18;

/**
 * Find an anchor on the visual line above (`direction = -1`) or below
 * (`direction = +1`) the caret rect, snapping to the goal X column.
 * Returns null when no anchor is reachable in that direction.
 */
export function pointToAnchorByVisualLine(
  doc: DocState,
  root: HTMLElement,
  fromRect: { left: number; top: number; height: number },
  goalX: number,
  direction: -1 | 1,
): Anchor | null {
  // Translate root-local goalX/fromRect back to viewport coordinates.
  const rootRect = root.getBoundingClientRect();
  const x = goalX + rootRect.left;
  const startY =
    direction < 0
      ? fromRect.top + rootRect.top - 1
      : fromRect.top + fromRect.height + rootRect.top + 1;
  // Step in line-height-sized increments until we either land on a
  // different visual line or fall off the doc.
  const step = (fromRect.height || LINE_HEIGHT_FALLBACK) * direction;
  let y = startY;
  // Cap iterations so misbehaving layout can't infinite-loop.
  for (let i = 0; i < 32; i++) {
    const anchor = pointToAnchor(doc, root, x, y);
    if (anchor) {
      // Re-measure the new anchor; if it's on the same line as the source,
      // step further.
      const nbId = anchor.blockId;
      const blockEl = findBlockElement(root, nbId);
      if (blockEl) {
        const offsetInBlock = isTextBearing(getBlock(doc, nbId)!)
          ? anchorOffset(anchor)
          : 0;
        const newRect = measureCaretRect(blockEl, offsetInBlock, root);
        if (newRect && Math.abs(newRect.top - fromRect.top) > 1) {
          return anchor;
        }
      } else {
        return anchor;
      }
    }
    y += step;
    // Stop when we walk past the editor in either direction.
    if (
      (direction < 0 && y < rootRect.top - rootRect.height) ||
      (direction > 0 && y > rootRect.top + rootRect.height * 4)
    ) {
      break;
    }
  }
  return null;
}
