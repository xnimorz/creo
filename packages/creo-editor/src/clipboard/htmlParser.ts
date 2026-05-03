import { newBlockId } from "../model/doc";
import type { BlockSpec, InlineRun, Mark } from "../model/types";

/**
 * Parse a fragment of HTML into a sanitized list of BlockSpec.
 *
 * Sanitization rules:
 *  - `<script>`, `<style>`, `<link>`, `<meta>` content is dropped entirely.
 *  - All `on*` attributes are stripped.
 *  - `javascript:` URLs become "#".
 *  - Unknown elements become inline (their text content is preserved, marks
 *    of any ancestor mark elements still apply).
 *  - Block elements outside our model (article, section, etc.) become
 *    paragraphs.
 *
 * Falls back to a single paragraph if no block-level structure is present.
 */
export function parseHTML(html: string): BlockSpec[] {
  const sanitized = sanitize(html);
  const tpl = document.createElement("template");
  tpl.innerHTML = sanitized;
  const frag = tpl.content;
  const out: BlockSpec[] = [];
  for (const node of Array.from(frag.childNodes)) {
    walkBlock(node, [], out);
  }
  // If we ended up with nothing, but the input had visible text, emit it as
  // a single paragraph.
  if (out.length === 0) {
    const text = collectText(frag);
    if (text.trim().length) {
      out.push({
        id: newBlockId(),
        type: "p",
        runs: [{ text }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sanitization — drop dangerous tags / URLs before parsing into a Document.
// ---------------------------------------------------------------------------

function sanitize(html: string): string {
  let s = html;
  // Drop script/style/link/meta blocks (incl. their inner content).
  s = s.replace(/<\s*(script|style|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|link|meta)\b[^>]*\/?>/gi, "");
  // Strip on* attributes.
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Neutralize javascript: URLs.
  s = s.replace(/(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, "$1=\"#\"");
  return s;
}

// ---------------------------------------------------------------------------
// Block walker
// ---------------------------------------------------------------------------

function walkBlock(node: Node, marks: Mark[], out: BlockSpec[]): void {
  if (node.nodeType === 3) {
    // Text outside any block container — wrap into a paragraph.
    const t = (node as Text).data;
    if (t.trim().length === 0) return;
    out.push({
      id: newBlockId(),
      type: "p",
      runs: [{ text: t, ...(marks.length ? { marks: new Set(marks) } : {}) }],
    });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case "p":
    case "div":
    case "section":
    case "article":
    case "aside":
    case "header":
    case "footer":
    case "main":
    case "blockquote": {
      const runs = collectRuns(el, marks);
      if (runs.length === 0 && el.childElementCount === 0) return;
      // If the container only has block-level children, recurse instead.
      if (hasBlockChild(el)) {
        for (const c of Array.from(el.childNodes)) walkBlock(c, marks, out);
        return;
      }
      out.push({
        id: newBlockId(),
        type: "p",
        runs: runs.length ? runs : [],
      });
      return;
    }

    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const runs = collectRuns(el, marks);
      out.push({
        id: newBlockId(),
        type: tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
        runs,
      });
      return;
    }

    case "ul":
    case "ol": {
      const ordered = tag === "ol";
      walkList(el, ordered, 0, marks, out);
      return;
    }

    case "li": {
      // Stray <li> outside <ul>/<ol> — treat as a paragraph.
      const runs = collectRuns(el, marks);
      out.push({ id: newBlockId(), type: "p", runs });
      return;
    }

    case "img": {
      const src = el.getAttribute("src") ?? "";
      if (!src) return;
      const alt = el.getAttribute("alt") ?? undefined;
      const w = numAttr(el, "width");
      const h = numAttr(el, "height");
      out.push({
        id: newBlockId(),
        type: "img",
        src,
        alt,
        width: w,
        height: h,
      });
      return;
    }

    case "table": {
      const block = parseTable(el, marks);
      if (block) out.push(block);
      return;
    }

    case "br":
      // A bare <br/> outside a block becomes an empty paragraph break.
      out.push({ id: newBlockId(), type: "p", runs: [] });
      return;

    default: {
      // Unknown block — flatten into runs and emit as a paragraph.
      if (hasBlockChild(el)) {
        for (const c of Array.from(el.childNodes)) walkBlock(c, marks, out);
        return;
      }
      const runs = collectRuns(el, marks);
      if (runs.length) out.push({ id: newBlockId(), type: "p", runs });
    }
  }
}

function walkList(
  listEl: HTMLElement,
  ordered: boolean,
  depth: 0 | 1 | 2 | 3,
  marks: Mark[],
  out: BlockSpec[],
): void {
  for (const child of Array.from(listEl.children)) {
    if (child.tagName.toLowerCase() !== "li") continue;
    const li = child as HTMLElement;
    // Each <li> is parsed as runs of its non-list children + nested
    // sub-lists become deeper li blocks.
    const runs: InlineRun[] = [];
    for (const c of Array.from(li.childNodes)) {
      if (c.nodeType === 1) {
        const tag = (c as HTMLElement).tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") continue;
      }
      runs.push(...runsFor(c, marks));
    }
    out.push({
      id: newBlockId(),
      type: "li",
      ordered,
      depth,
      runs,
    });
    // Nested lists.
    for (const c of Array.from(li.children)) {
      const tag = c.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        const nested = (c as HTMLElement);
        const nestedOrdered = tag === "ol";
        const nextDepth = (Math.min(3, depth + 1) as 0 | 1 | 2 | 3);
        walkList(nested, nestedOrdered, nextDepth, marks, out);
      }
    }
  }
}

function parseTable(tableEl: HTMLElement, marks: Mark[]): BlockSpec | null {
  const rowsEls: HTMLElement[] = [];
  for (const tr of Array.from(tableEl.querySelectorAll("tr"))) {
    rowsEls.push(tr as HTMLElement);
  }
  if (rowsEls.length === 0) return null;
  const cells: InlineRun[][][] = [];
  let cols = 0;
  for (const tr of rowsEls) {
    const row: InlineRun[][] = [];
    for (const td of Array.from(tr.children)) {
      const tag = td.tagName.toLowerCase();
      if (tag !== "td" && tag !== "th") continue;
      row.push(collectRuns(td as HTMLElement, marks));
    }
    cells.push(row);
    if (row.length > cols) cols = row.length;
  }
  // Pad short rows so every row has `cols` cells.
  for (const row of cells) {
    while (row.length < cols) row.push([]);
  }
  return {
    id: newBlockId(),
    type: "table",
    rows: cells.length,
    cols,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Inline-runs collection
// ---------------------------------------------------------------------------

const MARK_TAGS: Record<string, Mark> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
  s: "s",
  strike: "s",
  del: "s",
  code: "code",
};

function runsFor(node: Node, marks: Mark[]): InlineRun[] {
  if (node.nodeType === 3) {
    const t = (node as Text).data;
    if (t.length === 0) return [];
    return [
      {
        text: t,
        ...(marks.length ? { marks: new Set(marks) } : {}),
      },
    ];
  }
  if (node.nodeType !== 1) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") {
    // Inline newline — preserved as a literal newline character so consumers
    // can split if they care; our editor renders it as a single paragraph.
    return [{ text: "\n", ...(marks.length ? { marks: new Set(marks) } : {}) }];
  }
  const additional = MARK_TAGS[tag];
  const nextMarks = additional ? [...marks, additional] : marks;
  const out: InlineRun[] = [];
  for (const c of Array.from(el.childNodes)) {
    out.push(...runsFor(c, nextMarks));
  }
  return out;
}

function collectRuns(el: HTMLElement, marks: Mark[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const c of Array.from(el.childNodes)) {
    out.push(...runsFor(c, marks));
  }
  return out.filter((r) => r.text.length > 0);
}

function collectText(node: Node): string {
  let s = "";
  const walk = (n: Node) => {
    if (n.nodeType === 3) s += (n as Text).data;
    for (const c of Array.from(n.childNodes)) walk(c);
  };
  walk(node);
  return s;
}

function hasBlockChild(el: HTMLElement): boolean {
  for (const c of Array.from(el.children)) {
    const tag = c.tagName.toLowerCase();
    if (
      tag === "p" ||
      tag === "div" ||
      tag === "section" ||
      tag === "article" ||
      tag === "aside" ||
      tag === "header" ||
      tag === "footer" ||
      tag === "main" ||
      tag === "blockquote" ||
      tag === "ul" ||
      tag === "ol" ||
      tag === "li" ||
      tag === "table" ||
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) return true;
  }
  return false;
}

function numAttr(el: HTMLElement, name: string): number | undefined {
  const v = el.getAttribute(name);
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Plain text → blocks
// ---------------------------------------------------------------------------

export function parsePlainText(text: string): BlockSpec[] {
  // Treat blank lines as paragraph separators; collapse runs of \r\n.
  const normalized = text.replace(/\r\n?/g, "\n");
  const paragraphs = normalized.split(/\n+/);
  return paragraphs.map((para) => ({
    id: newBlockId(),
    type: "p",
    runs: para.length ? [{ text: para }] : [],
  }));
}
