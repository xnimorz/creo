import type { Store } from "creo";
import { isTextBearing, type TextBearingBlock } from "../model/blockText";
import { findPos, getBlock, updateBlock } from "../model/doc";
import { isCaret, orderedRange } from "../controller/selection";
import type {
  Block,
  DocState,
  ListItemBlock,
  Selection,
} from "../model/types";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

/**
 * Toggle whether the touched blocks are list items of the given `ordered`
 * kind.
 *  - If every touched text block is already a list item with that ordering,
 *    convert them back to paragraphs (and reset depth to 0).
 *  - Otherwise convert them to `li ordered=...` (preserving depth where
 *    possible, defaulting to 0).
 */
export function toggleList(
  { docStore, selStore }: Stores,
  ordered: boolean,
): boolean {
  const sel = selStore.get();
  const doc = docStore.get();
  const touchedIds = collectTouchedBlockIds(doc, sel);
  if (touchedIds.length === 0) return false;

  let allListed = true;
  for (const id of touchedIds) {
    const b = getBlock(doc, id)!;
    if (b.type !== "li" || (b as ListItemBlock).ordered !== ordered) {
      allListed = false;
      break;
    }
  }

  let working = doc;
  for (const id of touchedIds) {
    const b = getBlock(working, id);
    if (!b || !isTextBearing(b)) continue;
    if (allListed) {
      // Demote to paragraph.
      working = updateBlock(working, {
        id: b.id,
        index: b.index,
        type: "p",
        runs: (b as TextBearingBlock).runs,
      } as Block);
    } else {
      const li: ListItemBlock = {
        id: b.id,
        index: b.index,
        type: "li",
        ordered,
        depth:
          b.type === "li" ? (b as ListItemBlock).depth : 0,
        runs: (b as TextBearingBlock).runs,
      };
      working = updateBlock(working, li);
    }
  }
  docStore.set(working);
  return true;
}

/** Tab — increase list depth (max 3). No-op for non-list blocks. */
export function indentList({ docStore, selStore }: Stores): boolean {
  const ids = collectTouchedBlockIds(docStore.get(), selStore.get());
  let working = docStore.get();
  let changed = false;
  for (const id of ids) {
    const b = getBlock(working, id);
    if (!b || b.type !== "li") continue;
    const li = b as ListItemBlock;
    if (li.depth >= 3) continue;
    working = updateBlock(working, {
      ...li,
      depth: (li.depth + 1) as 0 | 1 | 2 | 3,
    });
    changed = true;
  }
  if (changed) docStore.set(working);
  return changed;
}

/** Shift+Tab — decrease list depth. At depth 0, convert back to paragraph. */
export function outdentList({ docStore, selStore }: Stores): boolean {
  const ids = collectTouchedBlockIds(docStore.get(), selStore.get());
  let working = docStore.get();
  let changed = false;
  for (const id of ids) {
    const b = getBlock(working, id);
    if (!b || b.type !== "li") continue;
    const li = b as ListItemBlock;
    if (li.depth > 0) {
      working = updateBlock(working, {
        ...li,
        depth: (li.depth - 1) as 0 | 1 | 2 | 3,
      });
      changed = true;
    } else {
      working = updateBlock(working, {
        id: li.id,
        index: li.index,
        type: "p",
        runs: li.runs,
      } as Block);
      changed = true;
    }
  }
  if (changed) docStore.set(working);
  return changed;
}

function collectTouchedBlockIds(
  doc: DocState,
  sel: Selection,
): string[] {
  if (isCaret(sel)) {
    return doc.byId.has(sel.at.blockId) ? [sel.at.blockId] : [];
  }
  const { start, end } = orderedRange(doc, sel);
  const startI = findPos(doc, start.blockId);
  const endI = findPos(doc, end.blockId);
  if (startI < 0 || endI < 0) return [];
  const out: string[] = [];
  for (let i = startI; i <= endI; i++) out.push(doc.order[i]!);
  return out;
}
