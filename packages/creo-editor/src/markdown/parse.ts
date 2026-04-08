import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Content, PhrasingContent, Text as MdastText, InlineCode, Strong, Emphasis, Delete, Link, Image, Heading, Paragraph, Blockquote, List, ListItem, Code, ThematicBreak, Html, Table, TableRow, TableCell } from "mdast";
import type { BlockNode, EditorNode, Mark } from "../model/types";
import { createBlockNode, createTextNode, createMark } from "../model/types";

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Parse a markdown string into an EditorNode document tree.
 */
export function parseMarkdown(markdown: string): BlockNode {
  const processor = unified().use(remarkParse).use(remarkGfm);
  const mdast = processor.parse(markdown);
  return mdastToDoc(mdast);
}

// ── mdast → EditorNode conversion ──────────────────────────────────────

function mdastToDoc(root: Root): BlockNode {
  const children: EditorNode[] = [];
  for (const child of root.children) {
    const node = convertBlock(child);
    if (node) children.push(node);
  }

  // Ensure doc has at least one paragraph
  if (children.length === 0) {
    children.push(createBlockNode("paragraph"));
  }

  return createBlockNode("doc", {}, children);
}

function convertBlock(node: Content): EditorNode | null {
  switch (node.type) {
    case "paragraph":
      return convertParagraph(node);
    case "heading":
      return convertHeading(node);
    case "blockquote":
      return convertBlockquote(node);
    case "list":
      return convertList(node);
    case "listItem":
      return convertListItem(node);
    case "code":
      return convertCodeBlock(node);
    case "thematicBreak":
      return createBlockNode("horizontal_rule", {}, [], [], true);
    case "html":
      return convertHtmlBlock(node);
    case "table":
      return convertTable(node);
    case "image":
      return createBlockNode("image", {
        src: node.url,
        alt: node.alt ?? undefined,
        title: node.title ?? undefined,
      }, [], [], true);
    default:
      // Fallback: try to extract text from nodes with children
      if ("children" in node && Array.isArray((node as unknown as { children: unknown[] }).children)) {
        const children = (node as unknown as { children: PhrasingContent[] }).children;
        const content = convertInlineContent(children);
        return createBlockNode("paragraph", {}, content);
      }
      return null;
  }
}

function convertParagraph(node: Paragraph | { children: PhrasingContent[] }): BlockNode {
  const content = convertInlineContent(node.children);
  return createBlockNode("paragraph", {}, content);
}

function convertHeading(node: Heading): BlockNode {
  const content = convertInlineContent(node.children);
  const level = Math.min(Math.max(node.depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
  return createBlockNode("heading", { level }, content);
}

function convertBlockquote(node: Blockquote): BlockNode {
  const children: EditorNode[] = [];
  for (const child of node.children) {
    const converted = convertBlock(child as Content);
    if (converted) children.push(converted);
  }
  if (children.length === 0) {
    children.push(createBlockNode("paragraph"));
  }
  return createBlockNode("blockquote", {}, children);
}

function convertList(node: List): BlockNode {
  const type = node.ordered ? "ordered_list" : "bullet_list";
  const attrs = node.ordered ? { start: node.start ?? 1 } : {};
  const items: EditorNode[] = [];

  for (const child of node.children) {
    const item = convertListItem(child);
    if (item) items.push(item);
  }

  return createBlockNode(type, attrs, items);
}

function convertListItem(node: ListItem): BlockNode {
  const children: EditorNode[] = [];

  for (const child of node.children) {
    const converted = convertBlock(child as Content);
    if (converted) children.push(converted);
  }

  if (children.length === 0) {
    children.push(createBlockNode("paragraph"));
  }

  return createBlockNode("list_item", {}, children);
}

function convertCodeBlock(node: Code): BlockNode {
  const attrs: Record<string, unknown> = {};
  if (node.lang) attrs["language"] = node.lang;

  const content: EditorNode[] = [];
  if (node.value) {
    content.push(createTextNode(node.value));
  }

  return createBlockNode("code_block", attrs, content);
}

function convertHtmlBlock(node: Html): BlockNode {
  return createBlockNode("html_block", { html: node.value }, [], [], true);
}

function convertTable(node: Table): BlockNode {
  const rows: EditorNode[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const row = node.children[i]!;
    const isHeader = i === 0;
    const cells: EditorNode[] = [];

    for (const cell of row.children) {
      const cellType = isHeader ? "table_header" : "table_cell";
      const content = convertInlineContent(cell.children);
      const cellNode = createBlockNode(cellType, {}, content.length > 0
        ? [createBlockNode("paragraph", {}, content)]
        : [createBlockNode("paragraph")]);
      cells.push(cellNode);
    }

    rows.push(createBlockNode("table_row", {}, cells));
  }

  return createBlockNode("table", {}, rows);
}

// ── Inline content conversion ──────────────────────────────────────────

function convertInlineContent(
  nodes: readonly PhrasingContent[],
  inheritedMarks: readonly Mark[] = [],
): EditorNode[] {
  const result: EditorNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        if (node.value.length > 0) {
          result.push(createTextNode(node.value, inheritedMarks));
        }
        break;

      case "strong":
        result.push(
          ...convertInlineContent(node.children, [...inheritedMarks, createMark("bold")]),
        );
        break;

      case "emphasis":
        result.push(
          ...convertInlineContent(node.children, [...inheritedMarks, createMark("italic")]),
        );
        break;

      case "delete":
        result.push(
          ...convertInlineContent(node.children, [...inheritedMarks, createMark("strikethrough")]),
        );
        break;

      case "inlineCode":
        result.push(
          createTextNode(node.value, [...inheritedMarks, createMark("code")]),
        );
        break;

      case "link":
        result.push(
          ...convertInlineContent(node.children, [
            ...inheritedMarks,
            createMark("link", { href: node.url, title: node.title ?? undefined }),
          ]),
        );
        break;

      case "image":
        // Inline images are treated as text placeholder
        result.push(createTextNode(node.alt || "image", inheritedMarks));
        break;

      case "html":
        // Inline HTML preserved as text
        if (node.value.length > 0) {
          result.push(createTextNode(node.value, inheritedMarks));
        }
        break;

      case "break":
        result.push(createTextNode("\n", inheritedMarks));
        break;

      default:
        // Fallback: try children or skip
        if ("children" in node && Array.isArray((node as unknown as { children: unknown[] }).children)) {
          result.push(
            ...convertInlineContent(
              (node as unknown as { children: PhrasingContent[] }).children,
              inheritedMarks,
            ),
          );
        } else if ("value" in node && typeof (node as unknown as { value: string }).value === "string") {
          const val = (node as unknown as { value: string }).value;
          if (val.length > 0) {
            result.push(createTextNode(val, inheritedMarks));
          }
        }
        break;
    }
  }

  // Merge adjacent text nodes with same marks
  return mergeTextNodes(result);
}

function mergeTextNodes(nodes: EditorNode[]): EditorNode[] {
  if (nodes.length <= 1) return nodes;

  const result: EditorNode[] = [nodes[0]!];
  for (let i = 1; i < nodes.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = nodes[i]!;

    if (
      prev.kind === "text" &&
      curr.kind === "text" &&
      marksEq(prev.marks, curr.marks)
    ) {
      result[result.length - 1] = createTextNode(prev.text + curr.text, prev.marks);
    } else {
      result.push(curr);
    }
  }
  return result;
}

function marksEq(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ma = a[i]!;
    const mb = b[i]!;
    if (ma.type !== mb.type) return false;
    const aAttrs = Object.entries(ma.attrs);
    const bAttrs = Object.entries(mb.attrs);
    if (aAttrs.length !== bAttrs.length) return false;
    for (const [k, v] of aAttrs) {
      if ((mb.attrs as Record<string, unknown>)[k] !== v) return false;
    }
  }
  return true;
}
