// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Editor factory
export { createEditor } from "./createEditor";
export type {
  Editor,
  EditorOptions,
  EditorViewProps,
  Command,
  SerializedBlock,
  SerializedDoc,
  SerializedRun,
} from "./createEditor";

// Render layer (advanced consumers)
export { DocView } from "./render/DocView";
export { CaretOverlay } from "./render/CaretOverlay";
export { SelectionHandles } from "./render/SelectionHandles";
export { MobileToolbar } from "./render/MobileToolbar";
export { ParagraphView } from "./render/blocks/ParagraphView";
export { HeadingView } from "./render/blocks/HeadingView";
export { ListItemView } from "./render/blocks/ListItemView";
export { TableView } from "./render/blocks/TableView";
export { ImageView } from "./render/blocks/ImageView";
export { InlineRunsView } from "./render/InlineRunsView";

// Mobile / input helpers
export { isCoarsePointer } from "./input/mobile";

// Virtualization
export { VirtualDoc } from "./virtual/VirtualDoc";
export { HeightIndex } from "./virtual/heightIndex";

// Model
export type {
  Block,
  BlockId,
  BlockSpec,
  BlockType,
  DistOmit,
  DocState,
  FracIndex,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
  InlineRun,
  ListItemBlock,
  Mark,
  ParagraphBlock,
  TableBlock,
  Anchor,
  Selection,
} from "./model/types";

export {
  emptyDoc,
  docFromBlocks,
  insertAt,
  insertAfter,
  insertWithIndex,
  insertManyAt,
  updateBlock,
  removeBlock,
  findInsertionPos,
  findPos,
  blockAt,
  getBlock,
  iterBlocks,
  newBlockId,
  maybeRebalance,
} from "./model/doc";

export {
  generateBetween,
  generateN,
  needsRebalance,
  rebalance,
  REBALANCE_THRESHOLD,
} from "./model/fractional";
