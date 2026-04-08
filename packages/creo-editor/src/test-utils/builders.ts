/**
 * Test node builders — adapted from ProseMirror's test-builder pattern.
 *
 * Usage:
 *   doc(p("hello ", bold("world")))
 *   heading({ level: 2 }, "Title")
 *   p(bold("a"), " b ", italic("c"))
 */

import type { EditorNode, BlockNode, TextNode, Mark, NodeAttrMap } from "../model/types";
import { createBlockNode, createTextNode, createMark } from "../model/types";

// Re-export the EditorNode type for convenience
export type TestNode = EditorNode;

// ── Inline content accumulator ─────────────────────────────────────────

type InlineContent = string | TextNode | MarkedText;

interface MarkedText {
  readonly __markedText: true;
  readonly marks: readonly Mark[];
  readonly content: readonly InlineContent[];
}

function isMarkedText(v: unknown): v is MarkedText {
  return typeof v === "object" && v !== null && "__markedText" in v;
}

function flattenInline(content: readonly InlineContent[], inheritedMarks: readonly Mark[] = []): TextNode[] {
  const result: TextNode[] = [];

  for (const item of content) {
    if (typeof item === "string") {
      if (item.length > 0) {
        result.push(createTextNode(item, inheritedMarks));
      }
    } else if (isMarkedText(item)) {
      const combined = [...inheritedMarks, ...item.marks];
      result.push(...flattenInline(item.content, combined));
    } else {
      // Already a TextNode — merge marks
      const combined = [...inheritedMarks, ...item.marks];
      result.push(createTextNode(item.text, combined));
    }
  }

  // Merge adjacent text nodes with same marks
  const merged: TextNode[] = [];
  for (const node of result) {
    const prev = merged[merged.length - 1];
    if (prev && marksEq(prev.marks, node.marks)) {
      merged[merged.length - 1] = createTextNode(prev.text + node.text, prev.marks);
    } else {
      merged.push(node);
    }
  }

  return merged;
}

function marksEq(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.type !== b[i]!.type) return false;
  }
  return true;
}

// ── Mark builders ──────────────────────────────────────────────────────

function markBuilder(markType: string, attrs: Record<string, unknown> = {}) {
  return (...content: InlineContent[]): MarkedText => ({
    __markedText: true,
    marks: [createMark(markType, attrs)],
    content,
  });
}

export const bold = markBuilder("bold");
export const italic = markBuilder("italic");
export const code = markBuilder("code");
export const strikethrough = markBuilder("strikethrough");
export function link(href: string, ...content: InlineContent[]): MarkedText {
  return {
    __markedText: true,
    marks: [createMark("link", { href })],
    content,
  };
}

// ── Block builders ─────────────────────────────────────────────────────

type BlockContent = EditorNode | InlineContent;

function inlineBlock(type: string, attrs: Record<string, unknown> = {}) {
  return (...content: BlockContent[]): BlockNode => {
    // Separate inline content from block children
    const children: EditorNode[] = [];
    const pendingInline: InlineContent[] = [];

    function flushInline() {
      if (pendingInline.length > 0) {
        children.push(...flattenInline(pendingInline));
        pendingInline.length = 0;
      }
    }

    for (const item of content) {
      if (typeof item === "string" || isMarkedText(item)) {
        pendingInline.push(item);
      } else if ("kind" in item && item.kind === "text") {
        pendingInline.push(item as TextNode);
      } else {
        flushInline();
        children.push(item as EditorNode);
      }
    }
    flushInline();

    return createBlockNode(type, attrs, children);
  };
}

function blockContainer(type: string, attrs: Record<string, unknown> = {}) {
  return (...content: EditorNode[]): BlockNode => {
    return createBlockNode(type, attrs, content);
  };
}

/** Top-level document node. */
export function doc(...content: EditorNode[]): BlockNode {
  return createBlockNode("doc", {}, content);
}

/** Paragraph. Can contain inline content. */
export function p(...content: BlockContent[]): BlockNode {
  return inlineBlock("paragraph")(...content);
}

/** Heading. First arg can be attrs object or inline content. */
export function heading(
  levelOrContent: { level: 1 | 2 | 3 | 4 | 5 | 6 } | BlockContent,
  ...rest: BlockContent[]
): BlockNode {
  if (typeof levelOrContent === "object" && "level" in levelOrContent) {
    return inlineBlock("heading", levelOrContent)(...rest);
  }
  return inlineBlock("heading", { level: 1 })(levelOrContent, ...rest);
}

/** Blockquote. Contains block children. */
export function blockquote(...content: EditorNode[]): BlockNode {
  return blockContainer("blockquote")(...content);
}

/** Code block. Contains raw text. */
export function codeBlock(langOrContent: string | { language: string }, ...rest: BlockContent[]): BlockNode {
  if (typeof langOrContent === "object" && "language" in langOrContent) {
    return inlineBlock("code_block", langOrContent)(...rest);
  }
  return inlineBlock("code_block")(langOrContent, ...rest);
}

/** Horizontal rule (atom leaf). */
export function hr(): BlockNode {
  return createBlockNode("horizontal_rule", {}, [], [], true);
}

/** Unordered list. */
export function ul(...items: BlockNode[]): BlockNode {
  return blockContainer("bullet_list")(...items);
}

/** Ordered list. */
export function ol(...items: BlockNode[]): BlockNode {
  return blockContainer("ordered_list", { start: 1 })(...items);
}

/** List item. Contains blocks. */
export function li(...content: EditorNode[]): BlockNode {
  return blockContainer("list_item")(...content);
}

/** Text node (for explicit use). */
export { createTextNode as text } from "../model/types";
