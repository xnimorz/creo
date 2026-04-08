/**
 * Paste handling — detects HTML vs markdown vs plain text
 * and converts to editor nodes for insertion.
 */

import type { EditorNode, Slice, BlockNode } from "../model/types";
import { createSlice, createTextNode, createBlockNode, isBlockNode } from "../model/types";
import { parseMarkdown } from "../markdown/parse";

// ── Paste data extraction ──────────────────────────────────────────────

export interface PasteData {
  readonly html: string | null;
  readonly text: string | null;
  readonly markdown: string | null;
}

export function extractPasteData(clipboardData: DataTransfer): PasteData {
  return {
    html: clipboardData.getData("text/html") || null,
    text: clipboardData.getData("text/plain") || null,
    markdown: null, // Some apps set this, but it's rare
  };
}

// ── Paste → Slice conversion ───────────────────────────────────────────

/**
 * Convert paste data to a Slice for insertion into the editor.
 *
 * Priority:
 * 1. HTML (if it looks like rich content)
 * 2. Plain text (treated as markdown if it contains MD patterns)
 */
export function pasteToSlice(data: PasteData): Slice {
  // Try HTML first
  if (data.html && isRichHtml(data.html)) {
    return htmlToSlice(data.html);
  }

  // Fall back to plain text
  if (data.text) {
    return textToSlice(data.text);
  }

  return { content: [], openStart: 0, openEnd: 0 };
}

/**
 * Check if HTML content is "rich" (not just a plain text wrapper).
 * Browsers wrap plain text in minimal HTML when copying from text fields.
 */
function isRichHtml(html: string): boolean {
  // If the HTML contains block-level elements, it's rich
  const blockTags = /<(p|div|h[1-6]|ul|ol|li|blockquote|table|pre|hr)\b/i;
  if (blockTags.test(html)) return true;

  // If it contains formatting tags, it's rich
  const formatTags = /<(strong|em|b|i|a|code|del|s)\b/i;
  if (formatTags.test(html)) return true;

  return false;
}

/**
 * Convert HTML string to a Slice.
 * Uses a temporary DOM element to parse the HTML, then converts to nodes.
 */
function htmlToSlice(html: string): Slice {
  // For environments without DOM (SSR), fall back to text
  if (typeof document === "undefined") {
    return textToSlice(stripHtmlTags(html));
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const nodes: EditorNode[] = [];

  for (let i = 0; i < container.childNodes.length; i++) {
    const child = container.childNodes[i]!;
    const node = domNodeToEditorNode(child);
    if (node) nodes.push(node);
  }

  if (nodes.length === 0) {
    // Fall back to plain text
    const text = container.textContent ?? "";
    if (text.length > 0) {
      return createSlice([createTextNode(text)]);
    }
    return { content: [], openStart: 0, openEnd: 0 };
  }

  return createSlice(nodes, 1, 1);
}

function domNodeToEditorNode(domNode: Node): EditorNode | null {
  if (domNode.nodeType === Node.TEXT_NODE) {
    const text = domNode.textContent ?? "";
    if (text.trim().length === 0) return null;
    return createTextNode(text);
  }

  if (domNode.nodeType !== Node.ELEMENT_NODE) return null;

  const el = domNode as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case "p":
    case "div": {
      const children = collectInlineChildren(el);
      return createBlockNode("paragraph", {}, children);
    }

    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
      const level = parseInt(tag[1]!, 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const children = collectInlineChildren(el);
      return createBlockNode("heading", { level }, children);
    }

    case "ul":
      return createBlockNode("bullet_list", {}, collectBlockChildren(el));

    case "ol":
      return createBlockNode("ordered_list", { start: 1 }, collectBlockChildren(el));

    case "li": {
      const children = collectBlockChildren(el);
      if (children.length === 0) {
        return createBlockNode("list_item", {}, [
          createBlockNode("paragraph", {}, collectInlineChildren(el)),
        ]);
      }
      return createBlockNode("list_item", {}, children);
    }

    case "blockquote":
      return createBlockNode("blockquote", {}, collectBlockChildren(el));

    case "pre": {
      const code = el.querySelector("code");
      const text = code ? code.textContent ?? "" : el.textContent ?? "";
      const lang = code?.className?.match(/language-(\w+)/)?.[1];
      const content = text.length > 0 ? [createTextNode(text)] : [];
      const attrs: Record<string, unknown> = {};
      if (lang) attrs["language"] = lang;
      return createBlockNode("code_block", attrs, content);
    }

    case "hr":
      return createBlockNode("horizontal_rule", {}, [], [], true);

    case "strong": case "b": case "em": case "i": case "code":
    case "del": case "s": case "a": {
      // Inline elements in block position — wrap in paragraph
      const children = collectInlineChildren(el);
      return createBlockNode("paragraph", {}, children);
    }

    default: {
      // Unknown tag — try to extract inline content, wrap in paragraph
      const children = collectInlineChildren(el);
      if (children.length > 0) {
        return createBlockNode("paragraph", {}, children);
      }
      return null;
    }
  }
}

function collectInlineChildren(el: HTMLElement): EditorNode[] {
  const nodes: EditorNode[] = [];

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]!;

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        nodes.push(createTextNode(text));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as HTMLElement;
      const tag = childEl.tagName.toLowerCase();

      // Inline formatting → text with marks
      const text = childEl.textContent ?? "";
      if (text.length === 0) continue;

      switch (tag) {
        case "strong": case "b":
          nodes.push(createTextNode(text, [{ type: "bold", attrs: {} }]));
          break;
        case "em": case "i":
          nodes.push(createTextNode(text, [{ type: "italic", attrs: {} }]));
          break;
        case "code":
          nodes.push(createTextNode(text, [{ type: "code", attrs: {} }]));
          break;
        case "del": case "s":
          nodes.push(createTextNode(text, [{ type: "strikethrough", attrs: {} }]));
          break;
        case "a": {
          const href = childEl.getAttribute("href") ?? "";
          nodes.push(createTextNode(text, [{ type: "link", attrs: { href } }]));
          break;
        }
        default:
          nodes.push(createTextNode(text));
          break;
      }
    }
  }

  return nodes;
}

function collectBlockChildren(el: HTMLElement): EditorNode[] {
  const nodes: EditorNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]!;
    const node = domNodeToEditorNode(child);
    if (node) nodes.push(node);
  }
  return nodes;
}

/**
 * Convert plain text to a Slice.
 * If the text looks like markdown, parse it. Otherwise, create text nodes.
 */
function textToSlice(text: string): Slice {
  // Check if it looks like markdown
  if (looksLikeMarkdown(text)) {
    const doc = parseMarkdown(text);
    return createSlice(doc.content, 1, 1);
  }

  // Split by paragraphs (double newlines)
  const paragraphs = text.split(/\n{2,}/);

  if (paragraphs.length <= 1) {
    // Single paragraph — just text
    const trimmed = text.replace(/\n/g, " ");
    if (trimmed.length === 0) {
      return { content: [], openStart: 0, openEnd: 0 };
    }
    return createSlice([createTextNode(trimmed)]);
  }

  // Multiple paragraphs
  const nodes: EditorNode[] = paragraphs
    .filter(p => p.trim().length > 0)
    .map(p => createBlockNode("paragraph", {}, [createTextNode(p.trim())]));

  return createSlice(nodes, 1, 1);
}

function looksLikeMarkdown(text: string): boolean {
  // Quick heuristic checks
  if (/^#{1,6}\s/.test(text)) return true;           // Headings
  if (/^\s*[-*+]\s/.test(text)) return true;          // Lists
  if (/^\s*\d+\.\s/.test(text)) return true;          // Ordered lists
  if (/^\s*>/.test(text)) return true;                 // Blockquotes
  if (/```/.test(text)) return true;                   // Code blocks
  if (/\*\*[^*]+\*\*/.test(text)) return true;        // Bold
  if (/\*[^*]+\*/.test(text)) return true;             // Italic
  if (/\[.+\]\(.+\)/.test(text)) return true;         // Links
  return false;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
