// ── Branded primitives ─────────────────────────────────────────────────

/** Absolute offset in the flattened document traversal. */
export type Pos = number & { readonly __brand: "Pos" };

/** Size of a node in the position space. */
export type NodeSize = number & { readonly __brand: "NodeSize" };

export function createPos(n: number): Pos {
  return n as Pos;
}

export function createNodeSize(n: number): NodeSize {
  return n as NodeSize;
}

// ── Node & Mark type identifiers ───────────────────────────────────────

/**
 * Built-in block node types.
 * Extensions add to this via declaration merging on NodeAttrMap.
 */
export type BuiltinNodeType =
  | "doc"
  | "paragraph"
  | "heading"
  | "blockquote"
  | "bullet_list"
  | "ordered_list"
  | "list_item"
  | "code_block"
  | "horizontal_rule"
  | "image"
  | "html_block"
  | "atomic_block";

export type NodeType = BuiltinNodeType | (string & {});

export type BuiltinMarkType =
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "link";

export type MarkType = BuiltinMarkType | (string & {});

// ── Node attribute map (compile-time validation per node type) ─────────

export interface NodeAttrMap {
  doc: Record<string, never>;
  paragraph: Record<string, never>;
  heading: { readonly level: 1 | 2 | 3 | 4 | 5 | 6 };
  blockquote: Record<string, never>;
  bullet_list: Record<string, never>;
  ordered_list: { readonly start?: number };
  list_item: Record<string, never>;
  code_block: { readonly language?: string };
  horizontal_rule: Record<string, never>;
  image: { readonly src: string; readonly alt?: string; readonly title?: string };
  html_block: { readonly html: string };
  atomic_block: { readonly blockType: string; readonly data: unknown };
}

export type NodeAttrs<T extends NodeType = NodeType> =
  T extends keyof NodeAttrMap ? Readonly<NodeAttrMap[T]> : Readonly<Record<string, unknown>>;

// ── Mark attribute map ─────────────────────────────────────────────────

export interface MarkAttrMap {
  bold: Record<string, never>;
  italic: Record<string, never>;
  strikethrough: Record<string, never>;
  code: Record<string, never>;
  link: { readonly href: string; readonly title?: string };
}

export type MarkAttrs<T extends MarkType = MarkType> =
  T extends keyof MarkAttrMap ? Readonly<MarkAttrMap[T]> : Readonly<Record<string, unknown>>;

// ── Mark ───────────────────────────────────────────────────────────────

export interface Mark {
  readonly type: MarkType;
  readonly attrs: Readonly<Record<string, unknown>>;
}

export function createMark<T extends MarkType>(
  type: T,
  attrs: T extends keyof MarkAttrMap ? MarkAttrMap[T] : Record<string, unknown> = {} as never,
): Mark {
  return { type, attrs };
}

export function marksEqual(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ma = a[i]!;
    const mb = b[i]!;
    if (ma.type !== mb.type) return false;
    const aKeys = Object.keys(ma.attrs);
    const bKeys = Object.keys(mb.attrs);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if ((ma.attrs as Record<string, unknown>)[key] !== (mb.attrs as Record<string, unknown>)[key]) return false;
    }
  }
  return true;
}

// ── EditorNode (discriminated union) ───────────────────────────────────

export interface BlockNode {
  readonly kind: "block";
  readonly type: NodeType;
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly marks: readonly Mark[];
  readonly content: readonly EditorNode[];
  /** Atom nodes are non-editable leaves that occupy 1 position. */
  readonly atom: boolean;
}

export interface TextNode {
  readonly kind: "text";
  readonly type: "text";
  readonly text: string;
  readonly marks: readonly Mark[];
}

export type EditorNode = BlockNode | TextNode;

// ── Node constructors ──────────────────────────────────────────────────

export function createBlockNode<T extends NodeType>(
  type: T,
  attrs: T extends keyof NodeAttrMap ? NodeAttrMap[T] : Record<string, unknown> = {} as never,
  content: readonly EditorNode[] = [],
  marks: readonly Mark[] = [],
  atom: boolean = false,
): BlockNode {
  return { kind: "block", type, attrs, content, marks, atom };
}

export function createTextNode(
  text: string,
  marks: readonly Mark[] = [],
): TextNode {
  if (text.length === 0) {
    throw new Error("Text nodes must have non-empty text");
  }
  return { kind: "text", type: "text", text, marks };
}

// ── Type guards ────────────────────────────────────────────────────────

export function isBlockNode(node: EditorNode): node is BlockNode {
  return node.kind === "block";
}

export function isTextNode(node: EditorNode): node is TextNode {
  return node.kind === "text";
}

// ── Node size calculation ──────────────────────────────────────────────

/**
 * Calculate the size a node occupies in the position space.
 *
 * - Text node: text.length
 * - Atom block: 1 (single position, not enterable)
 * - Non-atom block: 2 (open + close) + sum of children sizes
 */
export function nodeSize(node: EditorNode): NodeSize {
  if (isTextNode(node)) {
    return createNodeSize(node.text.length);
  }
  if (node.atom) {
    return createNodeSize(1);
  }
  let size = 2; // open + close boundaries
  for (const child of node.content) {
    size += nodeSize(child) as number;
  }
  return createNodeSize(size);
}

/**
 * Calculate the "content size" — the size of a block node's content
 * (excluding the open/close boundaries).
 */
export function contentSize(node: BlockNode): NodeSize {
  let size = 0;
  for (const child of node.content) {
    size += nodeSize(child) as number;
  }
  return createNodeSize(size);
}

// ── Slice (for insertions/replacements) ────────────────────────────────

export interface Slice {
  readonly content: readonly EditorNode[];
  readonly openStart: number;
  readonly openEnd: number;
}

export const emptySlice: Slice = { content: [], openStart: 0, openEnd: 0 };

export function createSlice(
  content: readonly EditorNode[],
  openStart: number = 0,
  openEnd: number = 0,
): Slice {
  return { content, openStart, openEnd };
}

// ── Node equality ──────────────────────────────────────────────────────

export function nodesEqual(a: EditorNode, b: EditorNode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.type !== b.type) return false;
  if (!marksEqual(a.marks, b.marks)) return false;

  if (isTextNode(a) && isTextNode(b)) {
    return a.text === b.text;
  }

  if (isBlockNode(a) && isBlockNode(b)) {
    const aKeys = Object.keys(a.attrs);
    const bKeys = Object.keys(b.attrs);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if ((a.attrs as Record<string, unknown>)[key] !== (b.attrs as Record<string, unknown>)[key]) return false;
    }
    if (a.content.length !== b.content.length) return false;
    for (let i = 0; i < a.content.length; i++) {
      if (!nodesEqual(a.content[i]!, b.content[i]!)) return false;
    }
    return true;
  }

  return false;
}
