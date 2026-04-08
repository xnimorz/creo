/**
 * Selection Sync — bidirectional mapping between DOM selection and model positions.
 *
 * The DOM structure mirrors the model because we rendered it:
 *   surface element  ↔  doc node
 *   block elements   ↔  block model nodes (paragraph, heading, etc.)
 *   text nodes       ↔  text model nodes (possibly wrapped in mark elements)
 *
 * Position model recap:
 *   - Atom block: occupies 1 position
 *   - Non-atom block: 2 (open+close) + sum of children sizes
 *   - Text node: text.length positions
 *   - Position 0 = start of doc's content (before first child)
 */

import type { Pos, BlockNode, EditorNode } from "../model/types";
import { createPos, isBlockNode, isTextNode, nodeSize } from "../model/types";
import type { Selection as EditorSelection, MultiSelection } from "../state/selection";
import { createSelection, createMultiSelection } from "../state/selection";

// ── DOM → Model ────────────────────────────────────────────────────────

/**
 * Convert a browser Selection to a model MultiSelection.
 */
export function domSelectionToModel(
  domSelection: globalThis.Selection,
  surface: HTMLElement,
  doc: BlockNode,
): MultiSelection | null {
  if (domSelection.rangeCount === 0) return null;

  const anchor = domSelection.anchorNode;
  const focus = domSelection.focusNode;
  if (!anchor || !surface.contains(anchor)) return null;

  const anchorPos = domPointToModelPos(anchor, domSelection.anchorOffset, surface, doc);
  if (anchorPos === null) return null;

  let headPos = anchorPos;
  if (focus && (focus !== anchor || domSelection.anchorOffset !== domSelection.focusOffset)) {
    const hp = domPointToModelPos(
      focus,
      domSelection.focusOffset,
      surface,
      doc,
    );
    if (hp !== null) headPos = hp;
  }

  return createMultiSelection([createSelection(anchorPos, headPos)]);
}

/**
 * Map a DOM point (node, offset) to an absolute model Pos.
 *
 * Strategy: build the path of block elements from `surface` down to the
 * node's containing block. Walk the model tree in parallel, accumulating
 * position offsets at each level. Then add the character offset within the
 * innermost block.
 */
function domPointToModelPos(
  node: Node,
  offset: number,
  surface: HTMLElement,
  doc: BlockNode,
): Pos | null {
  // If pointing at the surface itself, offset = top-level child index
  if (node === surface) {
    let pos = 0;
    for (let i = 0; i < offset && i < doc.content.length; i++) {
      pos += nodeSize(doc.content[i]!) as number;
    }
    return createPos(pos);
  }

  // Build the block path from surface → ... → innermost block containing the node
  const blockPath = buildBlockPath(node, surface);
  if (blockPath.length === 0) return null;

  // Walk model tree in parallel with blockPath to compute the base position.
  // Start at pos=1 because the doc node has an opening boundary at position 0.
  // Position 0 = entering doc; content starts at position 1 in replaceRange's
  // coordinate system (baseOffset=0, innerStart=1).
  let modelNode: BlockNode = doc;
  let pos = 0; // will become 1 after first block entry

  for (let pathIdx = 0; pathIdx < blockPath.length; pathIdx++) {
    const blockEl = blockPath[pathIdx]!;
    const parent = blockEl.parentElement;
    if (!parent) return null;

    // Find the index of blockEl among its block-level siblings
    const effectiveParent = pathIdx === 0 ? surface : blockPath[pathIdx - 1]!;
    const siblingIdx = blockChildIndex(blockEl, effectiveParent, surface);

    // Sum model sizes of preceding children at this level
    for (let i = 0; i < siblingIdx && i < modelNode.content.length; i++) {
      pos += nodeSize(modelNode.content[i]!) as number;
    }

    // Enter this block in the model (+1 for opening boundary)
    const modelChild = modelNode.content[siblingIdx];
    if (!modelChild || !isBlockNode(modelChild) || modelChild.atom) {
      // Can't go deeper — position is at this node's boundary
      return createPos(pos);
    }

    pos += 1; // opening boundary
    modelNode = modelChild;
  }

  // Now `modelNode` is the innermost block, `pos` is at the start of its content.
  // Add the character offset within this block.
  const innermostBlock = blockPath[blockPath.length - 1]!;

  let charOff = 0;
  if (node.nodeType === Node.TEXT_NODE) {
    charOff = charOffsetInBlock(node, offset, innermostBlock);
  } else if (node === innermostBlock) {
    charOff = charOffsetOfNthChild(innermostBlock, offset);
  } else {
    charOff = charOffsetInBlock(node, offset, innermostBlock);
  }

  pos += charOff;
  return createPos(pos);
}

/**
 * Build the path of block-level elements from the surface down to the
 * innermost block containing `node`. Excludes the surface itself.
 * Skips mark/inline wrappers (strong, em, a, code, etc.).
 */
function buildBlockPath(node: Node, surface: HTMLElement): Element[] {
  // First, collect all ancestors from node up to surface
  const ancestors: Element[] = [];
  let current: Node | null = node;

  // For text nodes, start from parent element
  if (current.nodeType === Node.TEXT_NODE) {
    current = current.parentNode;
  }

  while (current && current !== surface) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (!isInlineMarkElement(el)) {
        ancestors.unshift(el); // prepend — we want surface→leaf order
      }
    }
    current = current.parentNode;
  }

  if (current !== surface) return []; // node is not inside surface
  return ancestors;
}

/**
 * Find the index of a block element among its parent's block-level children.
 * Skips inline/mark wrapper elements and BR placeholders.
 */
function blockChildIndex(el: Element, parent: Element, surface: HTMLElement): number {
  let idx = 0;
  let child = parent.firstElementChild;
  while (child) {
    if (child === el) return idx;
    // Only count block-level children (skip BR, inline marks)
    if (child.tagName !== "BR" && !isInlineMarkElement(child)) {
      idx++;
    }
    child = child.nextElementSibling;
  }
  return idx;
}

// ── Model → DOM ────────────────────────────────────────────────────────

/**
 * Set the browser's Selection to match the model selection.
 */
export function modelSelectionToDOM(
  selection: MultiSelection,
  surface: HTMLElement,
  doc: BlockNode,
): void {
  const domSelection = window.getSelection();
  if (!domSelection) return;

  const primary = selection.ranges[selection.primary];
  if (!primary) return;

  const anchorPoint = modelPosToDOM(primary.anchor as number, surface, doc);
  const headPoint = (primary.anchor as number) === (primary.head as number)
    ? anchorPoint
    : modelPosToDOM(primary.head as number, surface, doc);

  if (!anchorPoint || !headPoint) return;

  try {
    domSelection.removeAllRanges();
    const range = document.createRange();

    if ((primary.anchor as number) <= (primary.head as number)) {
      range.setStart(anchorPoint.node, anchorPoint.offset);
      range.setEnd(headPoint.node, headPoint.offset);
    } else {
      range.setStart(headPoint.node, headPoint.offset);
      range.setEnd(anchorPoint.node, anchorPoint.offset);
    }

    domSelection.addRange(range);
  } catch {
    // Silently fail — DOM might be mid-update
  }
}

interface DOMPoint {
  node: Node;
  offset: number;
}

/**
 * Convert a model Pos to a DOM point.
 * Recursively walks the model tree, finding the matching DOM element at each level.
 */
function modelPosToDOM(
  targetPos: number,
  surface: HTMLElement,
  doc: BlockNode,
): DOMPoint | null {
  return walkModelToDOM(targetPos, 0, doc, surface);
}

function walkModelToDOM(
  targetPos: number,
  currentPos: number,
  modelNode: BlockNode,
  domEl: Element,
): DOMPoint | null {
  let pos = currentPos;
  const domBlocks = getBlockChildElements(domEl);

  for (let i = 0; i < modelNode.content.length; i++) {
    const child = modelNode.content[i]!;
    const size = nodeSize(child) as number;

    if (isTextNode(child)) {
      if (targetPos >= pos && targetPos <= pos + size) {
        // Target falls within this text node's character range
        const charOffset = targetPos - pos;
        return charPosToDOMPoint(charOffset, domEl, pos, modelNode, i);
      }
    } else if (isBlockNode(child)) {
      const domChild = domBlocks[i];

      if (targetPos === pos) {
        // Before this block
        return { node: domEl, offset: domChild ? domNodeIndex(domChild, domEl) : domEl.childNodes.length };
      }

      if (!child.atom && targetPos > pos && targetPos < pos + size && domChild) {
        // Inside this block — recurse
        return walkModelToDOM(targetPos, pos + 1, child, domChild);
      }

      if (targetPos === pos + size) {
        // Right after this block
        const idx = domChild ? domNodeIndex(domChild, domEl) + 1 : domEl.childNodes.length;
        return { node: domEl, offset: idx };
      }
    }

    pos += size;
  }

  // Past all children
  return { node: domEl, offset: domEl.childNodes.length };
}

/**
 * Find a DOM text node at a specific character position within a block element.
 * Uses TreeWalker to flatten all text nodes and count characters.
 *
 * `charOffset` is the character position relative to the start of the block's
 * text content (model text node index `startModelIdx` onward within `modelNode`).
 */
function charPosToDOMPoint(
  charOffset: number,
  blockEl: Element,
  modelPosBase: number,
  modelNode: BlockNode,
  startModelIdx: number,
): DOMPoint {
  // Count characters from all model text nodes before startModelIdx
  let charsBefore = 0;
  for (let j = 0; j < startModelIdx; j++) {
    const prev = modelNode.content[j];
    if (prev && isTextNode(prev)) {
      charsBefore += prev.text.length;
    }
  }

  const totalCharOffset = charsBefore + charOffset;
  return charPosToTextNode(totalCharOffset, blockEl);
}

/**
 * Map a flat character offset to a DOM Text node + offset within a block element.
 */
function charPosToTextNode(charPos: number, blockEl: Element): DOMPoint {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let remaining = charPos;
  let textNode = walker.nextNode() as Text | null;

  while (textNode) {
    if (remaining <= textNode.length) {
      return { node: textNode, offset: remaining };
    }
    remaining -= textNode.length;
    textNode = walker.nextNode() as Text | null;
  }

  // Past all text — return end of block
  return { node: blockEl, offset: blockEl.childNodes.length };
}

// ── DOM helpers ────────────────────────────────────────────────────────

/** Check if an element is an inline mark wrapper (strong, em, code, a, del, etc.) */
function isInlineMarkElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  return (
    tag === "strong" || tag === "b" ||
    tag === "em" || tag === "i" ||
    tag === "del" || tag === "s" ||
    tag === "code" || tag === "a" ||
    el.hasAttribute("data-mark")
  );
}

/** Get block-level child elements (skip BR, inline marks) */
function getBlockChildElements(parent: Element): Element[] {
  const result: Element[] = [];
  let child = parent.firstElementChild;
  while (child) {
    if (child.tagName !== "BR" && !isInlineMarkElement(child)) {
      result.push(child);
    }
    child = child.nextElementSibling;
  }
  return result;
}

/** Get the childNode index of an element within its parent */
function domNodeIndex(target: Element, parent: Element): number {
  let idx = 0;
  let child = parent.firstChild;
  while (child) {
    if (child === target) return idx;
    idx++;
    child = child.nextSibling;
  }
  return idx;
}

/**
 * Count the character offset of a DOM point within a block element.
 * For a Text node at charOffset, counts all preceding text in the block.
 * For an Element node at childIndex, counts all text in children before childIndex.
 */
function charOffsetInBlock(node: Node, offset: number, blockEl: Element): number {
  if (node.nodeType === Node.TEXT_NODE) {
    const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
    let chars = 0;
    let current = walker.nextNode();
    while (current) {
      if (current === node) {
        return chars + offset;
      }
      chars += (current as Text).length;
      current = walker.nextNode();
    }
    return chars + offset;
  }

  // Element node — count all text in children up to `offset`
  return charOffsetOfNthChild(node as Element, offset);
}

/**
 * Count total text characters in the first `n` child nodes of an element.
 */
function charOffsetOfNthChild(el: Element, n: number): number {
  let chars = 0;
  let idx = 0;
  let child = el.firstChild;
  while (child && idx < n) {
    chars += textLengthOf(child);
    idx++;
    child = child.nextSibling;
  }
  return chars;
}

/** Recursively count all text characters under a node */
function textLengthOf(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).length;
  }
  let len = 0;
  let child = node.firstChild;
  while (child) {
    len += textLengthOf(child);
    child = child.nextSibling;
  }
  return len;
}
