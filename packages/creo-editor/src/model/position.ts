import type { Pos, EditorNode, BlockNode } from "./types";
import { createPos, isBlockNode, isTextNode, nodeSize } from "./types";

// ── ResolvedPos ────────────────────────────────────────────────────────

export interface ResolvedPos {
  /** The absolute position. */
  readonly pos: Pos;

  /** Nesting depth (0 = inside doc). */
  readonly depth: number;

  /** The parent block node at this depth. */
  readonly parent: BlockNode;

  /** Index within parent's content array. */
  readonly index: number;

  /** Offset within the parent's content (the inner position). */
  readonly parentOffset: number;

  /** The node immediately after this position (if any). */
  readonly nodeAfter: EditorNode | null;

  /** The node immediately before this position (if any). */
  readonly nodeBefore: EditorNode | null;

  /** Ancestor chain from doc (depth 0) to parent (depth = depth). */
  readonly path: readonly PathEntry[];
}

export interface PathEntry {
  readonly node: BlockNode;
  readonly index: number;
  readonly offset: number;
}

// ── Resolve a position ─────────────────────────────────────────────────

/**
 * Resolve an absolute position to a ResolvedPos with full context.
 * Throws if the position is out of bounds.
 */
export function resolvePos(doc: BlockNode, pos: Pos): ResolvedPos {
  if ((pos as number) < 0) {
    throw new RangeError(`Position ${pos} is negative`);
  }

  const docSize = nodeSize(doc) as number;
  if ((pos as number) > docSize) {
    throw new RangeError(`Position ${pos} exceeds document size ${docSize}`);
  }

  const path: PathEntry[] = [];
  let node: BlockNode = doc;
  let offset = 0;

  // Walk down the tree
  // eslint-disable-next-line no-constant-condition
  outer: while (true) {
    // We are inside `node`, at position `offset` relative to the document start.
    // For a block node, offset points to just after the opening boundary.
    const innerPos = (pos as number) - offset;

    path.push({ node, index: 0, offset });

    // Check children
    let childOffset = 0;
    for (let i = 0; i < node.content.length; i++) {
      const child = node.content[i]!;
      const cSize = nodeSize(child) as number;

      if (childOffset + cSize > innerPos) {
        // Position falls within this child
        if (isBlockNode(child) && innerPos > childOffset && innerPos < childOffset + cSize) {
          // Position is inside this block child (not at its boundary)
          path[path.length - 1] = { node, index: i, offset };
          node = child;
          offset += childOffset + 1; // +1 for the opening boundary
          continue outer;
        }
        // Position is at a boundary or within a text node
        break;
      }

      childOffset += cSize;
    }

    // Position is at this depth
    const parentEntry = path[path.length - 1]!;

    // Find index and node before/after
    let cumOffset = 0;
    let index = 0;
    let nodeBefore: EditorNode | null = null;
    let nodeAfter: EditorNode | null = null;

    for (let i = 0; i < node.content.length; i++) {
      const child = node.content[i]!;
      const cSize = nodeSize(child) as number;

      if (cumOffset === innerPos) {
        index = i;
        nodeAfter = child;
        nodeBefore = i > 0 ? (node.content[i - 1] ?? null) : null;
        break;
      }

      if (cumOffset + cSize >= innerPos) {
        // We're inside a text node or at the end of a child
        if (isTextNode(child) && cumOffset + cSize > innerPos) {
          index = i;
          nodeAfter = null;
          nodeBefore = null;
        } else {
          index = i + 1;
          nodeBefore = child;
          nodeAfter = i + 1 < node.content.length ? (node.content[i + 1] ?? null) : null;
        }
        break;
      }

      cumOffset += cSize;

      if (i === node.content.length - 1) {
        // Past all children
        index = node.content.length;
        nodeBefore = child;
        nodeAfter = null;
      }
    }

    // Empty node case
    if (node.content.length === 0) {
      index = 0;
      nodeBefore = null;
      nodeAfter = null;
    }

    return {
      pos,
      depth: path.length - 1,
      parent: node,
      index,
      parentOffset: innerPos,
      nodeAfter,
      nodeBefore,
      path,
    };
  }
}

// ── Position helpers ───────────────────────────────────────────────────

/** Position at the start of a block node's content (just after opening boundary). */
export function posAtStartOf(doc: BlockNode, target: BlockNode): Pos {
  return findNodePos(doc, target, "start");
}

/** Position at the end of a block node's content (just before closing boundary). */
export function posAtEndOf(doc: BlockNode, target: BlockNode): Pos {
  return findNodePos(doc, target, "end");
}

function findNodePos(doc: BlockNode, target: BlockNode, where: "start" | "end"): Pos {
  let result: Pos | null = null;

  function walk(node: BlockNode, offset: number): boolean {
    if (node === target) {
      if (where === "start") {
        result = createPos(offset);
      } else {
        let size = 0;
        for (const child of node.content) {
          size += nodeSize(child) as number;
        }
        result = createPos(offset + size);
      }
      return true;
    }

    let childOffset = 0;
    for (const child of node.content) {
      if (isBlockNode(child)) {
        if (walk(child, offset + childOffset + 1)) return true;
      }
      childOffset += nodeSize(child) as number;
    }
    return false;
  }

  // Start inside doc (after doc's opening boundary)
  walk(doc, 1);

  if (result === null) {
    throw new Error("Target node not found in document");
  }
  return result;
}

/** Get the position just before a node at a given index in its parent. */
export function posBefore(doc: BlockNode, parentPath: readonly PathEntry[], childIndex: number): Pos {
  const last = parentPath[parentPath.length - 1];
  if (!last) throw new Error("Empty path");

  let offset = last.offset;
  // If parent is not doc, add 1 for its opening boundary
  if (parentPath.length > 1) {
    offset += 1;
  }

  for (let i = 0; i < childIndex && i < last.node.content.length; i++) {
    offset += nodeSize(last.node.content[i]!) as number;
  }

  return createPos(offset);
}
