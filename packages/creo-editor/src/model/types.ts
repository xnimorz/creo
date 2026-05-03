export type BlockId = string;
export type FracIndex = string;

export type Mark = "b" | "i" | "u" | "s" | "code";

export type InlineRun = {
  text: string;
  marks?: ReadonlySet<Mark>;
};

export type ParagraphBlock = {
  id: BlockId;
  index: FracIndex;
  type: "p";
  runs: InlineRun[];
};

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type HeadingBlock = {
  id: BlockId;
  index: FracIndex;
  type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  runs: InlineRun[];
};

export type ListItemBlock = {
  id: BlockId;
  index: FracIndex;
  type: "li";
  ordered: boolean;
  depth: 0 | 1 | 2 | 3;
  runs: InlineRun[];
};

export type ImageBlock = {
  id: BlockId;
  index: FracIndex;
  type: "img";
  src: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type TableBlock = {
  id: BlockId;
  index: FracIndex;
  type: "table";
  rows: number;
  cols: number;
  // cells[r][c] is an inline-runs sequence.
  cells: InlineRun[][][];
};

/**
 * Multi-column layout — N side-by-side columns of inline runs. Internal
 * cursor path = [colIndex, charOffset]. Same model shape as a 1-row
 * table but rendered as flex columns instead of an HTML <table>.
 */
export type ColumnsBlock = {
  id: BlockId;
  index: FracIndex;
  type: "columns";
  cols: number;
  /** cells[c] is the inline-runs sequence for column c. */
  cells: InlineRun[][];
};

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListItemBlock
  | ImageBlock
  | TableBlock
  | ColumnsBlock;

export type BlockType = Block["type"];

/**
 * Distributive `Omit` — applies Omit to each member of a union.
 * Plain `Omit<Union, K>` collapses the union into its intersection of fields,
 * which loses the discriminated-union shape.
 */
export type DistOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

/** A block missing its fractional `index` — used by callers that hand the doc
 *  layer un-indexed blocks for insertion. */
export type BlockSpec = DistOmit<Block, "index">;

export type DocState = {
  byId: Map<BlockId, Block>;
  order: BlockId[]; // sorted by Block.index ascending
};

// ---------------------------------------------------------------------------
// Selection / anchor types (used by controller)
// ---------------------------------------------------------------------------

/**
 * Anchor — points to a position inside a block.
 *  - For text-bearing blocks (p / h1..h6 / li): path = [charOffset]
 *  - For tables:                           path = [row, col, charOffset]
 *  - For images:                           path = [side]   side: 0 = before, 1 = after
 */
export type Anchor = {
  blockId: BlockId;
  path: number[];
  offset: number;
};

export type Selection =
  | { kind: "caret"; at: Anchor }
  | { kind: "range"; anchor: Anchor; focus: Anchor };
