/**
 * DOM Renderer — projects EditorNode tree to contenteditable DOM.
 *
 * This is separate from Creo's HtmlRender. It directly manages DOM
 * inside the contenteditable surface for synchronous updates.
 */

import type { EditorNode, BlockNode, TextNode, Mark } from "../model/types";
import { isBlockNode, isTextNode } from "../model/types";

// ── Tag mapping ────────────────────────────────────────────────────────

const BLOCK_TAG_MAP: Record<string, string> = {
  paragraph: "p",
  heading: "h1", // overridden by level attr
  blockquote: "blockquote",
  bullet_list: "ul",
  ordered_list: "ol",
  list_item: "li",
  code_block: "pre",
  horizontal_rule: "hr",
  image: "img",
  table: "table",
  table_row: "tr",
  table_cell: "td",
  table_header: "th",
};

const MARK_TAG_MAP: Record<string, string> = {
  bold: "strong",
  italic: "em",
  strikethrough: "del",
  code: "code",
  link: "a",
};

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Render an EditorNode document into a target DOM element.
 * Completely replaces the element's children.
 */
export function renderToDOM(doc: BlockNode, target: HTMLElement): void {
  // Clear existing content
  target.innerHTML = "";

  // Render each top-level block
  for (const child of doc.content) {
    const domNode = renderNode(child);
    if (domNode) {
      target.appendChild(domNode);
    }
  }
}

/**
 * Patch an existing DOM to match a new document tree.
 * Uses a simple diffing strategy: compare block-level children,
 * replace changed blocks, keep unchanged ones.
 */
export function patchDOM(
  oldDoc: BlockNode,
  newDoc: BlockNode,
  target: HTMLElement,
): void {
  const oldChildren = oldDoc.content;
  const newChildren = newDoc.content;
  const domChildren = target.childNodes;

  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const oldChild = oldChildren[i];
    const newChild = newChildren[i];
    const domChild = domChildren[i];

    if (!newChild) {
      // Extra old nodes — remove
      if (domChild) {
        target.removeChild(domChild);
        // Re-check index since we removed a node
        // (decrement handled by continuing with same index check)
      }
      continue;
    }

    if (!oldChild || !domChild) {
      // New node — append
      const newNode = renderNode(newChild);
      if (newNode) {
        target.appendChild(newNode);
      }
      continue;
    }

    if (!nodesShallowEqual(oldChild, newChild)) {
      // Changed — replace
      const newNode = renderNode(newChild);
      if (newNode) {
        target.replaceChild(newNode, domChild);
      }
    }
    // If equal, keep existing DOM node
  }

  // Remove excess DOM children
  while (target.childNodes.length > newChildren.length) {
    const last = target.lastChild;
    if (last) target.removeChild(last);
  }
}

// ── Node rendering ─────────────────────────────────────────────────────

function renderNode(node: EditorNode): Node | null {
  if (isTextNode(node)) {
    return renderTextNode(node);
  }
  if (isBlockNode(node)) {
    return renderBlockNode(node);
  }
  return null;
}

function renderBlockNode(node: BlockNode): HTMLElement | null {
  // Special cases
  switch (node.type) {
    case "html_block":
      return renderHtmlBlock(node);
    case "atomic_block":
      return renderAtomicBlock(node);
    case "image":
      return renderImage(node);
    case "horizontal_rule":
      return document.createElement("hr");
    case "code_block":
      return renderCodeBlock(node);
  }

  // Standard block
  let tag = BLOCK_TAG_MAP[node.type] ?? "div";

  // Heading level override
  if (node.type === "heading") {
    const level = (node.attrs as { level?: number }).level ?? 1;
    tag = `h${Math.min(Math.max(level, 1), 6)}`;
  }

  const el = document.createElement(tag);
  el.setAttribute("data-node-type", node.type);

  // Ordered list start
  if (node.type === "ordered_list") {
    const start = (node.attrs as { start?: number }).start;
    if (start !== undefined && start !== 1) {
      el.setAttribute("start", String(start));
    }
  }

  // Render children
  if (node.content.length === 0) {
    // Empty block — add a <br> so the cursor can be placed inside
    el.appendChild(document.createElement("br"));
  } else {
    for (const child of node.content) {
      const childNode = renderNode(child);
      if (childNode) {
        el.appendChild(childNode);
      }
    }
  }

  return el;
}

function renderTextNode(node: TextNode): Node {
  if (node.marks.length === 0) {
    return document.createTextNode(node.text);
  }

  // Wrap text in mark elements from outermost to innermost
  let innermost: Node = document.createTextNode(node.text);

  // Apply marks in order (first mark is outermost)
  for (let i = node.marks.length - 1; i >= 0; i--) {
    const mark = node.marks[i]!;
    const wrapper = createMarkElement(mark);
    wrapper.appendChild(innermost);
    innermost = wrapper;
  }

  return innermost;
}

function createMarkElement(mark: Mark): HTMLElement {
  const tag = MARK_TAG_MAP[mark.type] ?? "span";
  const el = document.createElement(tag);

  if (mark.type === "link") {
    const href = (mark.attrs as { href?: string }).href;
    if (href) {
      el.setAttribute("href", href);
    }
    const title = (mark.attrs as { title?: string }).title;
    if (title) {
      el.setAttribute("title", title);
    }
  }

  el.setAttribute("data-mark", mark.type);
  return el;
}

function renderCodeBlock(node: BlockNode): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");

  const language = (node.attrs as { language?: string }).language;
  if (language) {
    code.setAttribute("class", `language-${language}`);
    pre.setAttribute("data-language", language);
  }

  pre.setAttribute("data-node-type", "code_block");

  // Code blocks contain raw text — no marks
  const text = node.content
    .map(c => isTextNode(c) ? c.text : "")
    .join("");

  if (text.length > 0) {
    code.textContent = text;
  } else {
    code.appendChild(document.createElement("br"));
  }

  pre.appendChild(code);
  return pre;
}

function renderHtmlBlock(node: BlockNode): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-node-type", "html_block");
  wrapper.setAttribute("contenteditable", "false");
  wrapper.innerHTML = (node.attrs as { html: string }).html;
  return wrapper;
}

function renderAtomicBlock(node: BlockNode): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("data-node-type", "atomic_block");
  wrapper.setAttribute("data-block-type", (node.attrs as { blockType: string }).blockType);
  wrapper.setAttribute("contenteditable", "false");
  wrapper.classList.add("creo-editor-atomic");
  // Placeholder content — extensions provide custom rendering
  wrapper.textContent = `[${(node.attrs as { blockType: string }).blockType}]`;
  return wrapper;
}

function renderImage(node: BlockNode): HTMLElement {
  const wrapper = document.createElement("figure");
  wrapper.setAttribute("data-node-type", "image");
  wrapper.setAttribute("contenteditable", "false");

  const img = document.createElement("img");
  const attrs = node.attrs as { src: string; alt?: string; title?: string };
  img.setAttribute("src", attrs.src);
  if (attrs.alt) img.setAttribute("alt", attrs.alt);
  if (attrs.title) img.setAttribute("title", attrs.title);

  wrapper.appendChild(img);
  return wrapper;
}

// ── Shallow equality check for diffing ─────────────────────────────────

function nodesShallowEqual(a: EditorNode, b: EditorNode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.type !== b.type) return false;

  if (isTextNode(a) && isTextNode(b)) {
    if (a.text !== b.text) return false;
    if (a.marks.length !== b.marks.length) return false;
    for (let i = 0; i < a.marks.length; i++) {
      if (a.marks[i]!.type !== b.marks[i]!.type) return false;
    }
    return true;
  }

  if (isBlockNode(a) && isBlockNode(b)) {
    // For blocks, check attrs and content length
    const aKeys = Object.keys(a.attrs);
    const bKeys = Object.keys(b.attrs);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if ((a.attrs as Record<string, unknown>)[key] !== (b.attrs as Record<string, unknown>)[key]) return false;
    }
    if (a.content.length !== b.content.length) return false;
    // Recursively check children
    for (let i = 0; i < a.content.length; i++) {
      if (!nodesShallowEqual(a.content[i]!, b.content[i]!)) return false;
    }
    return true;
  }

  return false;
}

// ── DOM parser (reading DOM back to EditorNode) ────────────────────────

/**
 * Parse a DOM element tree back into an EditorNode.
 * Used for reconciliation when unexpected mutations occur.
 */
export function parseDOMToNode(element: HTMLElement): BlockNode {
  const type = element.getAttribute("data-node-type") ?? tagToNodeType(element.tagName.toLowerCase());
  const attrs = parseDOMAttrs(element, type);
  const content: EditorNode[] = [];

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i]!;

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        content.push({ kind: "text", type: "text", text, marks: [] });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as HTMLElement;
      const markType = childEl.getAttribute("data-mark") ?? tagToMarkType(childEl.tagName.toLowerCase());

      if (markType) {
        // It's a mark wrapper — extract text with marks
        const innerNodes = parseInlineDOM(childEl, [{ type: markType, attrs: parseMarkAttrs(childEl, markType) }]);
        content.push(...innerNodes);
      } else {
        // It's a block child
        content.push(parseDOMToNode(childEl));
      }
    }
  }

  const atom = type === "horizontal_rule" || type === "image" || type === "html_block" || type === "atomic_block";
  return { kind: "block", type, attrs, content, marks: [], atom };
}

function parseInlineDOM(element: HTMLElement, marks: readonly Mark[]): EditorNode[] {
  const result: EditorNode[] = [];

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i]!;

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        result.push({ kind: "text", type: "text", text, marks: [...marks] });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as HTMLElement;
      const markType = childEl.getAttribute("data-mark") ?? tagToMarkType(childEl.tagName.toLowerCase());

      if (markType) {
        const newMarks = [...marks, { type: markType, attrs: parseMarkAttrs(childEl, markType) }];
        result.push(...parseInlineDOM(childEl, newMarks));
      }
    }
  }

  return result;
}

function tagToNodeType(tag: string): string {
  switch (tag) {
    case "p": return "paragraph";
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return "heading";
    case "blockquote": return "blockquote";
    case "ul": return "bullet_list";
    case "ol": return "ordered_list";
    case "li": return "list_item";
    case "pre": return "code_block";
    case "hr": return "horizontal_rule";
    case "img": return "image";
    case "table": return "table";
    case "tr": return "table_row";
    case "td": return "table_cell";
    case "th": return "table_header";
    case "figure": return "image";
    default: return "paragraph";
  }
}

function tagToMarkType(tag: string): string | null {
  switch (tag) {
    case "strong": case "b": return "bold";
    case "em": case "i": return "italic";
    case "del": case "s": return "strikethrough";
    case "code": return "code";
    case "a": return "link";
    default: return null;
  }
}

function parseDOMAttrs(element: HTMLElement, type: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  if (type === "heading") {
    const tag = element.tagName.toLowerCase();
    const level = parseInt(tag.charAt(1), 10);
    if (level >= 1 && level <= 6) attrs["level"] = level;
  }

  if (type === "ordered_list") {
    const start = element.getAttribute("start");
    if (start) attrs["start"] = parseInt(start, 10);
  }

  if (type === "code_block") {
    const lang = element.getAttribute("data-language");
    if (lang) attrs["language"] = lang;
  }

  if (type === "image") {
    const img = element.tagName === "IMG" ? element : element.querySelector("img");
    if (img) {
      attrs["src"] = img.getAttribute("src") ?? "";
      const alt = img.getAttribute("alt");
      if (alt) attrs["alt"] = alt;
      const title = img.getAttribute("title");
      if (title) attrs["title"] = title;
    }
  }

  if (type === "html_block") {
    attrs["html"] = element.innerHTML;
  }

  if (type === "atomic_block") {
    attrs["blockType"] = element.getAttribute("data-block-type") ?? "unknown";
  }

  return attrs;
}

function parseMarkAttrs(element: HTMLElement, markType: string): Record<string, unknown> {
  if (markType === "link") {
    const href = element.getAttribute("href");
    const title = element.getAttribute("title");
    const attrs: Record<string, unknown> = {};
    if (href) attrs["href"] = href;
    if (title) attrs["title"] = title;
    return attrs;
  }
  return {};
}
