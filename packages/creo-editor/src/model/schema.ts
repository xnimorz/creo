import type { NodeType, MarkType, EditorNode, Mark, BlockNode } from "./types";
import { isBlockNode, isTextNode } from "./types";

// ── Content expression ─────────────────────────────────────────────────

/**
 * A simplified content expression describing what children a node can have.
 *
 * Format: "group+" or "group*" or "type1 type2" or "" (no children).
 * - "block+": one or more block nodes
 * - "block*": zero or more block nodes
 * - "inline*": zero or more inline nodes (text + inline marks)
 * - "list_item+": one or more list_item nodes
 * - "table_row+": one or more table_row nodes
 * - "": leaf node, no children allowed
 */
export type ContentExpression = string;

// ── Node spec ──────────────────────────────────────────────────────────

export interface NodeSpec {
  /** Content expression for allowed children. Empty string = leaf node. */
  readonly content: ContentExpression;

  /** Group this node belongs to (e.g., "block", "inline"). */
  readonly group?: string;

  /** Allowed mark types on content. "_" = all, "" = none. Undefined = all. */
  readonly marks?: string;

  /** Whether this node is inline (flows within a block). */
  readonly inline?: boolean;

  /** Whether this is an atomic (non-editable) leaf node. */
  readonly atom?: boolean;

  /** Default attribute values. */
  readonly attrs?: Readonly<Record<string, { readonly default?: unknown }>>;
}

// ── Mark spec ──────────────────────────────────────────────────────────

export interface MarkSpec {
  /** Whether the mark extends to content typed at its edge. Default: true. */
  readonly inclusive?: boolean;

  /** Group this mark belongs to. */
  readonly group?: string;

  /** Default attribute values. */
  readonly attrs?: Readonly<Record<string, { readonly default?: unknown }>>;
}

// ── Schema ─────────────────────────────────────────────────────────────

export interface Schema {
  readonly nodes: Readonly<Record<string, NodeSpec>>;
  readonly marks: Readonly<Record<string, MarkSpec>>;

  /** Cached: set of node types belonging to each group. */
  readonly nodeGroups: Readonly<Record<string, ReadonlySet<string>>>;
}

export function createSchema(
  nodes: Record<string, NodeSpec>,
  marks: Record<string, MarkSpec> = {},
): Schema {
  const nodeGroups: Record<string, Set<string>> = {};

  for (const [name, spec] of Object.entries(nodes)) {
    if (spec.group) {
      for (const g of spec.group.split(" ")) {
        if (!nodeGroups[g]) nodeGroups[g] = new Set();
        nodeGroups[g].add(name);
      }
    }
  }

  return {
    nodes,
    marks,
    nodeGroups: nodeGroups as Record<string, ReadonlySet<string>>,
  };
}

// ── Content validation ─────────────────────────────────────────────────

interface ParsedContentExpr {
  readonly alternatives: readonly ContentAtom[];
}

interface ContentAtom {
  readonly nodeType: string;  // concrete type or group name
  readonly isGroup: boolean;
  readonly min: number;       // 0 for *, 1 for +
  readonly max: number;       // Infinity for * and +
}

function parseContentExpr(expr: ContentExpression): ParsedContentExpr {
  if (expr === "") return { alternatives: [] };

  const parts = expr.trim().split(/\s+/);
  const alternatives: ContentAtom[] = [];

  for (const part of parts) {
    let nodeType: string;
    let min = 1;
    let max = 1;

    if (part.endsWith("+")) {
      nodeType = part.slice(0, -1);
      min = 1;
      max = Infinity;
    } else if (part.endsWith("*")) {
      nodeType = part.slice(0, -1);
      min = 0;
      max = Infinity;
    } else if (part.endsWith("?")) {
      nodeType = part.slice(0, -1);
      min = 0;
      max = 1;
    } else {
      nodeType = part;
    }

    alternatives.push({ nodeType, isGroup: false, min, max });
  }

  return { alternatives };
}

/**
 * Check if a node's content matches its schema's content expression.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateContent(node: BlockNode, schema: Schema): string | null {
  const spec = schema.nodes[node.type];
  if (!spec) return `Unknown node type: ${node.type}`;

  const expr = parseContentExpr(spec.content);

  // Leaf node: no children allowed
  if (expr.alternatives.length === 0) {
    if (node.content.length > 0) {
      return `Node '${node.type}' is a leaf and cannot have children`;
    }
    return null;
  }

  // For simplicity, handle the common single-expression case
  // (e.g., "block+", "inline*", "list_item+")
  if (expr.alternatives.length === 1) {
    const atom = expr.alternatives[0]!;
    const allowedTypes = resolveTypes(atom.nodeType, schema);

    for (const child of node.content) {
      const childType = isTextNode(child) ? "text" : child.type;
      if (!allowedTypes.has(childType)) {
        return `Node '${node.type}' cannot contain '${childType}' (allowed: ${atom.nodeType})`;
      }
    }

    if (node.content.length < atom.min) {
      return `Node '${node.type}' requires at least ${atom.min} children of type '${atom.nodeType}'`;
    }

    return null;
  }

  // Multi-expression: sequential match (e.g., "heading paragraph+")
  // For now, allow any combination of types from the union of all alternatives
  const allAllowed = new Set<string>();
  for (const atom of expr.alternatives) {
    for (const t of resolveTypes(atom.nodeType, schema)) {
      allAllowed.add(t);
    }
  }

  for (const child of node.content) {
    const childType = isTextNode(child) ? "text" : child.type;
    if (!allAllowed.has(childType)) {
      return `Node '${node.type}' cannot contain '${childType}'`;
    }
  }

  return null;
}

function resolveTypes(nameOrGroup: string, schema: Schema): ReadonlySet<string> {
  // Check if it's a group name
  const group = schema.nodeGroups[nameOrGroup];
  if (group) return group;

  // It's a concrete type
  return new Set([nameOrGroup]);
}

/**
 * Check if a mark type is allowed on content within a given node.
 */
export function isMarkAllowed(markType: MarkType, parentNodeType: NodeType, schema: Schema): boolean {
  const spec = schema.nodes[parentNodeType];
  if (!spec) return false;

  if (spec.marks === undefined || spec.marks === "_") return true;
  if (spec.marks === "") return false;

  const allowed = spec.marks.split(" ");
  return allowed.includes(markType);
}

/**
 * Check if a node type is an atom (non-editable leaf).
 */
export function isAtomNode(nodeType: NodeType, schema: Schema): boolean {
  return schema.nodes[nodeType]?.atom === true;
}

/**
 * Validate an entire document tree against the schema.
 * Returns an array of error messages (empty = valid).
 */
export function validateDocument(doc: EditorNode, schema: Schema): readonly string[] {
  const errors: string[] = [];

  function walk(node: EditorNode, path: string) {
    if (isBlockNode(node)) {
      const err = validateContent(node, schema);
      if (err) errors.push(`${path}: ${err}`);

      for (let i = 0; i < node.content.length; i++) {
        walk(node.content[i]!, `${path}/${node.type}[${i}]`);
      }
    }

    // Validate marks
    for (const mark of node.marks) {
      if (!schema.marks[mark.type]) {
        errors.push(`${path}: Unknown mark type '${mark.type}'`);
      }
    }
  }

  walk(doc, "");
  return errors;
}
