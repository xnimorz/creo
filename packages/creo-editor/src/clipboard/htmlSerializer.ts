import { iterBlocks } from "../model/doc";
import {
  blockTextLength,
  isTextBearing,
  splitRunsAt,
  type TextBearingBlock,
} from "../model/blockText";
import {
  anchorOffset,
  orderedRange,
} from "../controller/selection";
import type {
  Block,
  DocState,
  InlineRun,
  ListItemBlock,
  Mark,
  Selection,
  TableBlock,
} from "../model/types";

const MARK_TAGS: Record<Mark, string> = {
  b: "strong",
  i: "em",
  u: "u",
  s: "s",
  code: "code",
};

const MARK_ORDER: Mark[] = ["code", "b", "i", "u", "s"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePlain(s: string): string {
  return s.replace(/​/g, "");
}

function runsToHtml(runs: InlineRun[]): string {
  let out = "";
  for (const r of runs) {
    let inner = escapeHtml(r.text);
    if (r.marks && r.marks.size) {
      // Wrap inside-out using MARK_ORDER (matches the renderer).
      for (const m of MARK_ORDER) {
        if (!r.marks.has(m)) continue;
        const tag = MARK_TAGS[m];
        inner = `<${tag}>${inner}</${tag}>`;
      }
    }
    out += inner;
  }
  return out;
}

function blockToHtml(block: Block, listOpen: { tag: string | null }): string {
  let prefix = "";
  if (block.type === "li") {
    const li = block as ListItemBlock;
    const wantTag = li.ordered ? "ol" : "ul";
    if (listOpen.tag !== wantTag) {
      if (listOpen.tag) prefix += `</${listOpen.tag}>`;
      prefix += `<${wantTag}>`;
      listOpen.tag = wantTag;
    }
  } else if (listOpen.tag) {
    prefix += `</${listOpen.tag}>`;
    listOpen.tag = null;
  }

  switch (block.type) {
    case "p":
      return prefix + `<p>${runsToHtml(block.runs)}</p>`;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return prefix + `<${block.type}>${runsToHtml(block.runs)}</${block.type}>`;
    case "li": {
      const li = block as ListItemBlock;
      return (
        prefix +
        `<li data-depth="${li.depth}">${runsToHtml(li.runs)}</li>`
      );
    }
    case "img": {
      const attrs: string[] = [`src="${escapeHtml(block.src)}"`];
      if (block.alt) attrs.push(`alt="${escapeHtml(block.alt)}"`);
      if (block.width) attrs.push(`width="${block.width}"`);
      if (block.height) attrs.push(`height="${block.height}"`);
      return prefix + `<img ${attrs.join(" ")}/>`;
    }
    case "table": {
      const t = block as TableBlock;
      let s = prefix + "<table><tbody>";
      for (let r = 0; r < t.rows; r++) {
        s += "<tr>";
        for (let c = 0; c < t.cols; c++) {
          s += `<td>${runsToHtml(t.cells[r]?.[c] ?? [])}</td>`;
        }
        s += "</tr>";
      }
      s += "</tbody></table>";
      return s;
    }
    case "columns": {
      // Best-effort HTML serialization — round-trips into a flex-like grid.
      // External pasters won't recognize the data-creo-columns marker but
      // the col text content is preserved.
      let s = prefix + `<div data-creo-columns="${block.cols}" style="display:grid;grid-template-columns:repeat(${block.cols},1fr);gap:16px;">`;
      for (let c = 0; c < block.cols; c++) {
        s += `<div data-col="${c}">${runsToHtml(block.cells[c] ?? [])}</div>`;
      }
      s += "</div>";
      return s;
    }
  }
}

/** Whole-doc serialization (used by toJSON-ish helpers and copy-all). */
export function docToHtml(doc: DocState): string {
  const listOpen = { tag: null as string | null };
  let html = "";
  for (const b of iterBlocks(doc)) html += blockToHtml(b, listOpen);
  if (listOpen.tag) html += `</${listOpen.tag}>`;
  return html;
}

export function docToPlain(doc: DocState): string {
  const lines: string[] = [];
  for (const b of iterBlocks(doc)) {
    if (isTextBearing(b)) {
      lines.push(escapePlain(runsText((b as TextBearingBlock).runs)));
    } else if (b.type === "img") {
      lines.push(b.alt ?? "[image]");
    } else if (b.type === "table") {
      const t = b as TableBlock;
      for (let r = 0; r < t.rows; r++) {
        const cols: string[] = [];
        for (let c = 0; c < t.cols; c++) {
          cols.push(escapePlain(runsText(t.cells[r]?.[c] ?? [])));
        }
        lines.push(cols.join("\t"));
      }
    } else if (b.type === "columns") {
      const cols: string[] = [];
      for (let c = 0; c < b.cols; c++) {
        cols.push(escapePlain(runsText(b.cells[c] ?? [])));
      }
      lines.push(cols.join("\t"));
    }
  }
  return lines.join("\n");
}

function runsText(runs: InlineRun[]): string {
  let s = "";
  for (const r of runs) s += r.text;
  return s;
}

// ---------------------------------------------------------------------------
// Selection serialization — produce HTML + plain text for the OS clipboard.
// ---------------------------------------------------------------------------

export type ClipboardPayload = {
  html: string;
  plain: string;
};

export function selectionToClipboard(
  doc: DocState,
  sel: Selection,
): ClipboardPayload {
  if (sel.kind === "caret") return { html: "", plain: "" };
  const { start, end } = orderedRange(doc, sel);
  // Build the relevant block slices. For a single block, slice the runs;
  // for multiple, the start block keeps its tail, the end block keeps its
  // head, and the middle blocks are full.
  if (start.blockId === end.blockId) {
    const block = doc.byId.get(start.blockId);
    if (!block || !isTextBearing(block)) return { html: "", plain: "" };
    const sOff = anchorOffset(start);
    const eOff = anchorOffset(end);
    const [_l, midRight] = splitRunsAt(
      (block as TextBearingBlock).runs,
      sOff,
    );
    const [middle] = splitRunsAt(midRight, eOff - sOff);
    const slice: TextBearingBlock = {
      ...(block as TextBearingBlock),
      runs: middle,
    };
    const listOpen = { tag: null as string | null };
    let html = blockToHtml(slice as Block, listOpen);
    if (listOpen.tag) html += `</${listOpen.tag}>`;
    return { html, plain: runsText(middle) };
  }
  // Multi-block.
  const startI = doc.order.indexOf(start.blockId);
  const endI = doc.order.indexOf(end.blockId);
  if (startI < 0 || endI < 0) return { html: "", plain: "" };
  const listOpen = { tag: null as string | null };
  let html = "";
  const lines: string[] = [];
  for (let i = startI; i <= endI; i++) {
    const b = doc.byId.get(doc.order[i]!)!;
    let slice: Block = b;
    if (isTextBearing(b)) {
      let runs = (b as TextBearingBlock).runs;
      if (i === startI) {
        const [, right] = splitRunsAt(runs, anchorOffset(start));
        runs = right;
      }
      if (i === endI) {
        const len = blockTextLength({
          ...(b as TextBearingBlock),
          runs,
        } as TextBearingBlock);
        const eOff = anchorOffset(end) - (i === startI ? anchorOffset(start) : 0);
        const [left] = splitRunsAt(runs, Math.min(len, eOff));
        runs = left;
      }
      slice = { ...(b as TextBearingBlock), runs } as Block;
      lines.push(runsText(runs));
    } else {
      lines.push(
        b.type === "img"
          ? (b.alt ?? "[image]")
          : b.type === "columns"
            ? "[columns]"
            : "[table]",
      );
    }
    html += blockToHtml(slice, listOpen);
  }
  if (listOpen.tag) html += `</${listOpen.tag}>`;
  return { html, plain: lines.join("\n") };
}
