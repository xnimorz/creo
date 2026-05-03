import {
  generateBetween,
  generateN,
  needsRebalance,
  rebalance,
} from "./fractional";
import type { Block, BlockId, BlockSpec, DocState, FracIndex } from "./types";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let __idCounter = 0;
const __sessionPrefix = Math.floor(Math.random() * 0xffffffff)
  .toString(36)
  .padStart(7, "0");

/** Cheap, monotonically increasing block id with a per-session prefix. */
export function newBlockId(): BlockId {
  __idCounter = (__idCounter + 1) | 0;
  return `b_${__sessionPrefix}_${__idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// DocState construction
// ---------------------------------------------------------------------------

export function emptyDoc(): DocState {
  return { byId: new Map(), order: [] };
}

/** Build a DocState from a list of blocks (will assign indices if missing). */
export function docFromBlocks(blocks: BlockSpec[]): DocState {
  const indices = generateN(null, null, blocks.length);
  const doc = emptyDoc();
  for (let i = 0; i < blocks.length; i++) {
    const b = { ...blocks[i]!, index: indices[i]! } as Block;
    doc.byId.set(b.id, b);
    doc.order.push(b.id);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Order helpers — binary search over `order` keyed by Block.index
// ---------------------------------------------------------------------------

/**
 * Returns the insertion index in `order` such that the new key sorts at that
 * position. Pure binary search by `Block.index`.
 */
export function findInsertionPos(doc: DocState, index: FracIndex): number {
  let lo = 0;
  let hi = doc.order.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const midIdx = doc.byId.get(doc.order[mid]!)!.index;
    if (midIdx < index) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Returns the position of `id` in `order`, or -1 if not found. */
export function findPos(doc: DocState, id: BlockId): number {
  const block = doc.byId.get(id);
  if (!block) return -1;
  // Binary-search by index (faster than linear once doc is large).
  let lo = 0;
  let hi = doc.order.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const cur = doc.byId.get(doc.order[mid]!)!;
    if (cur.index < block.index) lo = mid + 1;
    else if (cur.index > block.index) hi = mid;
    else return mid;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// CRUD — all return a NEW DocState (immutable from the caller's perspective).
// `byId` and `order` are replaced rather than mutated so referential identity
// signals "the doc changed".
// ---------------------------------------------------------------------------

/**
 * Insert `block` between the blocks at positions [pos-1] and [pos].
 * The new block's `index` is overwritten with a fractional key in that gap.
 */
export function insertAt(
  doc: DocState,
  pos: number,
  block: BlockSpec,
): DocState {
  const before =
    pos <= 0 ? null : doc.byId.get(doc.order[pos - 1]!)!.index;
  const after =
    pos >= doc.order.length
      ? null
      : doc.byId.get(doc.order[pos]!)!.index;
  const index = generateBetween(before, after);
  return insertWithIndex(doc, { ...block, index } as Block);
}

/** Insert a block whose `index` has already been assigned. */
export function insertWithIndex(doc: DocState, block: Block): DocState {
  if (doc.byId.has(block.id)) {
    throw new Error(`insertWithIndex: duplicate block id ${block.id}`);
  }
  const pos = findInsertionPos(doc, block.index);
  const order = doc.order.slice();
  order.splice(pos, 0, block.id);
  const byId = new Map(doc.byId);
  byId.set(block.id, block);
  return { byId, order };
}

/** Insert `block` immediately after `afterId` (or at the start if null). */
export function insertAfter(
  doc: DocState,
  afterId: BlockId | null,
  block: BlockSpec,
): DocState {
  const pos = afterId == null ? 0 : findPos(doc, afterId) + 1;
  return insertAt(doc, pos, block);
}

/** Replace the block with the same id. */
export function updateBlock(doc: DocState, block: Block): DocState {
  if (!doc.byId.has(block.id)) {
    throw new Error(`updateBlock: unknown id ${block.id}`);
  }
  const byId = new Map(doc.byId);
  byId.set(block.id, block);
  // Order doesn't change unless the index changed.
  const prev = doc.byId.get(block.id)!;
  if (prev.index === block.index) {
    return { byId, order: doc.order };
  }
  // Re-sort: remove + reinsert by new index.
  const order = doc.order.filter((x) => x !== block.id);
  const interim: DocState = { byId, order };
  const pos = findInsertionPos(interim, block.index);
  order.splice(pos, 0, block.id);
  return { byId, order };
}

/** Remove a block. */
export function removeBlock(doc: DocState, id: BlockId): DocState {
  if (!doc.byId.has(id)) return doc;
  const byId = new Map(doc.byId);
  byId.delete(id);
  const order = doc.order.filter((x) => x !== id);
  return { byId, order };
}

/**
 * Bulk-insert: drop `n` new blocks evenly spaced into the gap before `pos`.
 * Faster than calling insertAt repeatedly because we compute all keys at once.
 */
export function insertManyAt(
  doc: DocState,
  pos: number,
  blocks: BlockSpec[],
): DocState {
  if (blocks.length === 0) return doc;
  const before =
    pos <= 0 ? null : doc.byId.get(doc.order[pos - 1]!)!.index;
  const after =
    pos >= doc.order.length
      ? null
      : doc.byId.get(doc.order[pos]!)!.index;
  const indices = generateN(before, after, blocks.length);
  const byId = new Map(doc.byId);
  const order = doc.order.slice();
  for (let i = 0; i < blocks.length; i++) {
    const b = { ...blocks[i]!, index: indices[i]! } as Block;
    if (byId.has(b.id)) {
      throw new Error(`insertManyAt: duplicate block id ${b.id}`);
    }
    byId.set(b.id, b);
    order.splice(pos + i, 0, b.id);
  }
  return { byId, order };
}

// ---------------------------------------------------------------------------
// Rebalance — once any key grows past the soft threshold, regenerate keys.
// ---------------------------------------------------------------------------

export function maybeRebalance(doc: DocState): DocState {
  const keys = doc.order.map((id) => doc.byId.get(id)!.index);
  if (!needsRebalance(keys)) return doc;
  const fresh = rebalance(doc.order.length);
  const byId = new Map<BlockId, Block>();
  for (let i = 0; i < doc.order.length; i++) {
    const id = doc.order[i]!;
    const block = doc.byId.get(id)!;
    byId.set(id, { ...block, index: fresh[i]! } as Block);
  }
  return { byId, order: doc.order.slice() };
}

// ---------------------------------------------------------------------------
// Iteration / lookup
// ---------------------------------------------------------------------------

export function* iterBlocks(doc: DocState): IterableIterator<Block> {
  for (const id of doc.order) {
    yield doc.byId.get(id)!;
  }
}

export function getBlock(doc: DocState, id: BlockId): Block | undefined {
  return doc.byId.get(id);
}

export function blockAt(doc: DocState, pos: number): Block | undefined {
  const id = doc.order[pos];
  return id == null ? undefined : doc.byId.get(id);
}
