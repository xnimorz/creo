import { _ } from "creo";
import { div, store, view } from "creo";
import type { PointerEventData, PublicView, Store } from "creo";
import { moveTo } from "./commands/navigationCommands";
import {
  tableInsertCol as cmdTableInsertCol,
  tableInsertRow as cmdTableInsertRow,
  tableRemoveCol as cmdTableRemoveCol,
  tableRemoveRow as cmdTableRemoveRow,
} from "./commands/tableCommands";
import {
  attachClipboard,
  type ClipboardHandle,
} from "./clipboard/clipboard";
import { attachDrop, type DropHandle } from "./clipboard/drop";
import { parseHTML } from "./clipboard/htmlParser";
import { selectionToClipboard } from "./clipboard/htmlSerializer";
import { deleteSelectedImage } from "./commands/imageCommands";
import {
  attachVisualViewport,
  type ViewportHandle,
} from "./input/mobile";
import { MobileToolbar } from "./render/MobileToolbar";
import { SelectionHandles } from "./render/SelectionHandles";
import { homeOfDoc, endOfDocAnchor } from "./controller/navigation";
import {
  insertBlocks as cmdInsertBlocks,
  insertColumns as cmdInsertColumns,
  insertImage as cmdInsertImage,
  insertTable as cmdInsertTable,
} from "./commands/insertCommands";
import {
  indentList as cmdIndentList,
  outdentList as cmdOutdentList,
  toggleList as cmdToggleList,
} from "./commands/listCommands";
import { toggleMark as cmdToggleMark } from "./commands/markCommands";
import {
  mergeBackward as cmdMergeBackward,
  mergeForward as cmdMergeForward,
  setBlockType as cmdSetBlockType,
  splitBlock as cmdSplitBlock,
  type SetBlockTypePayload,
} from "./commands/structuralCommands";
import {
  deleteBackward as cmdDeleteBackward,
  deleteForward as cmdDeleteForward,
  insertText as cmdInsertText,
} from "./commands/textCommands";
import { caret, endOfDoc } from "./controller/selection";
import { wordRangeAt } from "./controller/wordBoundary";
import { runsAt } from "./model/cellAccess";
import { createHistory, type History } from "./controller/history";
import { attachAutoRebalance } from "./model/rebalance";
import { HiddenInput } from "./input/HiddenInput";
import {
  attachInputPipeline,
  type PipelineHandle,
} from "./input/inputPipeline";
import { docFromBlocks, emptyDoc, newBlockId } from "./model/doc";
import type {
  Anchor,
  Block,
  BlockSpec,
  DocState,
  InlineRun,
  Mark,
  Selection,
} from "./model/types";
import { CaretOverlay } from "./render/CaretOverlay";
import { DocView } from "./render/DocView";
import { pointToAnchor } from "./render/measure";
import { VirtualDoc } from "./virtual/VirtualDoc";

let __editorIdCounter = 0;

// ---------------------------------------------------------------------------
// Public-facing types
// ---------------------------------------------------------------------------

export type SerializedRun = {
  text: string;
  marks?: string[]; // mark identifiers
};

export type SerializedBlock =
  | { id?: string; type: "p"; runs: SerializedRun[] }
  | { id?: string; type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; runs: SerializedRun[] }
  | {
      id?: string;
      type: "li";
      ordered: boolean;
      depth?: 0 | 1 | 2 | 3;
      runs: SerializedRun[];
    }
  | {
      id?: string;
      type: "img";
      src: string;
      alt?: string;
      width?: number;
      height?: number;
    }
  | {
      id?: string;
      type: "table";
      rows: number;
      cols: number;
      cells: SerializedRun[][][];
    }
  | {
      id?: string;
      type: "columns";
      cols: number;
      cells: SerializedRun[][];
    };

export type SerializedDoc = {
  blocks: SerializedBlock[];
};

export type EditorViewProps = {
  class?: string;
};

export type Command =
  | { t: "noop" }
  | { t: "insertText"; text: string }
  | { t: "deleteBackward" }
  | { t: "deleteForward" }
  | { t: "splitBlock" }
  | { t: "mergeBackward" }
  | { t: "mergeForward" }
  | { t: "setBlockType"; payload: SetBlockTypePayload }
  | { t: "toggleMark"; mark: Mark }
  | { t: "toggleList"; ordered: boolean }
  | { t: "indentList" }
  | { t: "outdentList" }
  | {
      t: "insertImage";
      src: string;
      alt?: string;
      width?: number;
      height?: number;
    }
  | { t: "insertTable"; rows: number; cols: number }
  | { t: "insertColumns"; cols: number }
  | { t: "tableInsertRow"; where: "above" | "below" }
  | { t: "tableInsertCol"; where: "before" | "after" }
  | { t: "tableRemoveRow" }
  | { t: "tableRemoveCol" }
  | { t: "moveCursor"; to: Anchor; extend?: boolean };

export type EditorMode = "regular" | "mono";

export type EditorOptions = {
  initial?: SerializedDoc;
  uploadImage?: (f: File) => Promise<string>;
  /**
   * Enable virtualized rendering — only blocks intersecting the viewport
   * are mounted. Recommended for documents with > ~500 blocks. The host
   * page must put a scroll container around the editor for this to work.
   */
  virtualized?: boolean;
  /** Estimated block height (px) when virtualized — default 32. */
  virtualEstimatedHeight?: number;
  /**
   * "regular" → system sans-serif body font, headings/blocks styled normally.
   * "mono"    → monospaced font on every block (good for code editors,
   *             markdown source, log inspection). Affects font-family on
   *             the editor root via the `creo-editor-mono` class.
   */
  mode?: EditorMode;
};

export type Editor = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
  dispatch: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  EditorView: PublicView<EditorViewProps, void>;
  setDocFromHTML: (html: string) => void;
  toJSON: () => SerializedDoc;
  // Imperative focus / blur — wired in M3+.
  focus: () => void;
  blur: () => void;
};

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function deserializeRun(r: SerializedRun): InlineRun {
  if (!r.marks || r.marks.length === 0) return { text: r.text };
  // Filter to known marks.
  const allowed = new Set(["b", "i", "u", "s", "code"]);
  const marks = new Set<InlineRun extends { marks?: ReadonlySet<infer M> }
    ? M
    : never>();
  for (const m of r.marks) {
    if (allowed.has(m)) marks.add(m as never);
  }
  return marks.size === 0 ? { text: r.text } : { text: r.text, marks };
}

function deserializeDoc(s: SerializedDoc): DocState {
  const blocks: BlockSpec[] = s.blocks.map((sb) => {
    const id = sb.id ?? newBlockId();
    switch (sb.type) {
      case "p":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return {
          id,
          type: sb.type,
          runs: sb.runs.map(deserializeRun),
        } as BlockSpec;
      case "li":
        return {
          id,
          type: "li",
          ordered: sb.ordered,
          depth: sb.depth ?? 0,
          runs: sb.runs.map(deserializeRun),
        } as BlockSpec;
      case "img":
        return {
          id,
          type: "img",
          src: sb.src,
          alt: sb.alt,
          width: sb.width,
          height: sb.height,
        } as BlockSpec;
      case "table":
        return {
          id,
          type: "table",
          rows: sb.rows,
          cols: sb.cols,
          cells: sb.cells.map((row) =>
            row.map((cell) => cell.map(deserializeRun)),
          ),
        } as BlockSpec;
      case "columns":
        return {
          id,
          type: "columns",
          cols: sb.cols,
          cells: sb.cells.map((cell) => cell.map(deserializeRun)),
        } as BlockSpec;
    }
  });
  return docFromBlocks(blocks);
}

function serializeRun(r: InlineRun): SerializedRun {
  if (!r.marks || r.marks.size === 0) return { text: r.text };
  return { text: r.text, marks: [...r.marks] };
}

function serializeDoc(doc: DocState): SerializedDoc {
  const blocks: SerializedBlock[] = [];
  for (const id of doc.order) {
    const b = doc.byId.get(id)!;
    switch (b.type) {
      case "p":
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        blocks.push({ id: b.id, type: b.type, runs: b.runs.map(serializeRun) });
        break;
      case "li":
        blocks.push({
          id: b.id,
          type: "li",
          ordered: b.ordered,
          depth: b.depth,
          runs: b.runs.map(serializeRun),
        });
        break;
      case "img":
        blocks.push({
          id: b.id,
          type: "img",
          src: b.src,
          alt: b.alt,
          width: b.width,
          height: b.height,
        });
        break;
      case "columns":
        blocks.push({
          id: b.id,
          type: "columns",
          cols: b.cols,
          cells: b.cells.map((cell) => cell.map(serializeRun)),
        });
        break;
      case "table":
        blocks.push({
          id: b.id,
          type: "table",
          rows: b.rows,
          cols: b.cols,
          cells: b.cells.map((row) =>
            row.map((cell) => cell.map(serializeRun)),
          ),
        });
        break;
    }
  }
  return { blocks };
}

// ---------------------------------------------------------------------------
// createEditor
// ---------------------------------------------------------------------------

function historyTagFor(cmd: Command): string {
  switch (cmd.t) {
    // Coalesce-eligible groups — same prefix → merged into one undo step.
    case "insertText":
      return "text:insert";
    case "deleteBackward":
      return "text:deleteBack";
    case "deleteForward":
      return "text:deleteFwd";
    default:
      return cmd.t;
  }
}

function defaultSelection(doc: DocState): Selection {
  // Cursor sits at the end of the last block — gives the implicit "type to
  // append" behaviour M3 promises before the caret overlay (M4) lands.
  return { kind: "caret", at: endOfDoc(doc) };
}

/** Build a range selecting the word containing `anchor`. */
function selectWordAt(
  doc: DocState,
  anchor: Anchor,
): { kind: "range"; anchor: Anchor; focus: Anchor } | null {
  const block = docGet(doc, anchor.blockId);
  if (!block) return null;
  const ctx = runsAt(block, anchor);
  if (!ctx) return null;
  let text = "";
  for (const r of ctx.runs) text += r.text;
  const offsetField =
    anchor.path.length >= 3 ? anchor.path[2] ?? 0 : anchor.path[0] ?? 0;
  const [ws, we] = wordRangeAt(text, offsetField);
  if (ws === we) return null;
  const tablePrefix =
    anchor.path.length >= 3
      ? [anchor.path[0]!, anchor.path[1]!]
      : ([] as number[]);
  return {
    kind: "range",
    anchor: {
      blockId: anchor.blockId,
      path: tablePrefix.length ? [...tablePrefix, ws] : [ws],
      offset: ws,
    },
    focus: {
      blockId: anchor.blockId,
      path: tablePrefix.length ? [...tablePrefix, we] : [we],
      offset: we,
    },
  };
}

/** Build a range selecting the entire block (or current cell, for tables). */
function selectBlockAt(
  doc: DocState,
  anchor: Anchor,
): { kind: "range"; anchor: Anchor; focus: Anchor } | null {
  const block = docGet(doc, anchor.blockId);
  if (!block) return null;
  const ctx = runsAt(block, anchor);
  if (!ctx) return null;
  let len = 0;
  for (const r of ctx.runs) len += r.text.length;
  if (len === 0) return null;
  const tablePrefix =
    anchor.path.length >= 3
      ? [anchor.path[0]!, anchor.path[1]!]
      : ([] as number[]);
  return {
    kind: "range",
    anchor: {
      blockId: anchor.blockId,
      path: tablePrefix.length ? [...tablePrefix, 0] : [0],
      offset: 0,
    },
    focus: {
      blockId: anchor.blockId,
      path: tablePrefix.length ? [...tablePrefix, len] : [len],
      offset: len,
    },
  };
}

function docGet(doc: DocState, id: string) {
  return doc.byId.get(id);
}

export function createEditor(opts: EditorOptions = {}): Editor {
  const editorId = `creo-editor-${++__editorIdCounter}`;

  const initialDoc = opts.initial
    ? deserializeDoc(opts.initial)
    : seedEmpty();
  const docStore = store.new<DocState>(initialDoc);

  // Selection store — separate from doc so caret movement doesn't dirty the
  // document subscribers (and vice versa).
  const selStore = store.new<Selection>(defaultSelection(initialDoc));

  let pipeline: PipelineHandle | null = null;
  let clipboard: ClipboardHandle | null = null;
  let drop: DropHandle | null = null;
  let viewport: ViewportHandle | null = null;

  const history: History = createHistory({ docStore, selStore });
  // Microtask rebalance — keeps fractional indices short under adversarial
  // insertion patterns. No-op on every doc change unless any key has
  // outgrown the soft threshold.
  attachAutoRebalance(docStore);

  const dispatch = (cmd: Command): void => {
    // Snapshot for undo BEFORE mutating. Tag drives coalescing.
    history.record(historyTagFor(cmd));
    switch (cmd.t) {
      case "noop":
        return;
      case "insertText":
        cmdInsertText({ docStore, selStore }, cmd.text);
        return;
      case "deleteBackward":
        cmdDeleteBackward({ docStore, selStore });
        return;
      case "deleteForward":
        cmdDeleteForward({ docStore, selStore });
        return;
      case "splitBlock":
        cmdSplitBlock({ docStore, selStore });
        return;
      case "mergeBackward":
        cmdMergeBackward({ docStore, selStore });
        return;
      case "mergeForward":
        cmdMergeForward({ docStore, selStore });
        return;
      case "setBlockType":
        cmdSetBlockType({ docStore, selStore }, cmd.payload);
        return;
      case "toggleMark":
        cmdToggleMark({ docStore, selStore }, cmd.mark);
        return;
      case "toggleList":
        cmdToggleList({ docStore, selStore }, cmd.ordered);
        return;
      case "indentList":
        cmdIndentList({ docStore, selStore });
        return;
      case "outdentList":
        cmdOutdentList({ docStore, selStore });
        return;
      case "insertImage":
        cmdInsertImage(
          { docStore, selStore },
          { src: cmd.src, alt: cmd.alt, width: cmd.width, height: cmd.height },
        );
        return;
      case "insertTable":
        cmdInsertTable(
          { docStore, selStore },
          { rows: cmd.rows, cols: cmd.cols },
        );
        return;
      case "insertColumns":
        cmdInsertColumns({ docStore, selStore }, { cols: cmd.cols });
        return;
      case "tableInsertRow":
        cmdTableInsertRow({ docStore, selStore }, cmd.where);
        return;
      case "tableInsertCol":
        cmdTableInsertCol({ docStore, selStore }, cmd.where);
        return;
      case "tableRemoveRow":
        cmdTableRemoveRow({ docStore, selStore });
        return;
      case "tableRemoveCol":
        cmdTableRemoveCol({ docStore, selStore });
        return;
      case "moveCursor":
        moveTo({ docStore, selStore }, cmd.to, cmd.extend === true);
        return;
    }
  };

  const undo = (): void => {
    history.undo();
  };
  const redo = (): void => {
    history.redo();
  };

  const setDocFromHTML = (html: string): void => {
    const blocks = parseHTML(html);
    if (blocks.length === 0) return;
    docStore.set(docFromBlocks(blocks));
    selStore.set(defaultSelection(docStore.get()));
    history.reset();
  };

  const toJSON = (): SerializedDoc => serializeDoc(docStore.get());

  const focus = (): void => {
    pipeline?.focus();
  };
  const blur = (): void => {
    pipeline?.blur();
  };

  const handleCopy = (): void => {
    const sel = selStore.get();
    if (sel.kind === "caret") return;
    const payload = selectionToClipboard(docStore.get(), sel);
    // Mobile-toolbar Copy is best-effort: the OS's "Allow paste from
    // clipboard?" gate kicks in only on the SECOND clipboard write inside
    // the same gesture on iOS, so we accept the silent failure path.
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(payload.plain).catch(() => {});
    }
  };
  const handleCut = (): void => {
    handleCopy();
    cmdDeleteBackward({ docStore, selStore });
  };
  const handlePaste = async (): Promise<void> => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) cmdInsertText({ docStore, selStore }, text);
    } catch {
      // Clipboard read often denied without a recent gesture — silent fail.
    }
  };
  const handleSelectAll = (): void => {
    const doc = docStore.get();
    const start = homeOfDoc(doc);
    const end = endOfDocAnchor(doc);
    selStore.set({ kind: "range", anchor: start, focus: end });
  };

  // Mouse / touch click + drag + double/triple-click state machine. Lives
  // in plain closures (not Creo state) because pointermove fires at very
  // high frequency and we don't want to dirty any view to handle it.
  const dragState = {
    active: false,
    /** Anchor where the mousedown landed; held as the FIXED side of the range. */
    fixed: null as Anchor | null,
    lastClickAt: 0,
    lastClickX: 0,
    lastClickY: 0,
    clickCount: 1,
  };

  const handleRootPointerDown = (e: PointerEventData): void => {
    pipeline?.focus();
    const root = document.querySelector(
      `[data-creo-editor="${editorId}"]`,
    ) as HTMLElement | null;
    if (!root) return;
    const anchor = pointToAnchor(docStore.get(), root, e.x, e.y);
    if (!anchor) return;

    // Multi-click detection: same point + within 400ms = click chain.
    const now = Date.now();
    const dx = e.x - dragState.lastClickX;
    const dy = e.y - dragState.lastClickY;
    const sameSpot = dx * dx + dy * dy < 64; // within 8px
    const withinWindow = now - dragState.lastClickAt < 400;
    dragState.clickCount =
      sameSpot && withinWindow ? dragState.clickCount + 1 : 1;
    dragState.lastClickAt = now;
    dragState.lastClickX = e.x;
    dragState.lastClickY = e.y;

    if (dragState.clickCount === 2) {
      // Double-click: select the word at the anchor.
      const wordSel = selectWordAt(docStore.get(), anchor);
      if (wordSel) {
        selStore.set(wordSel);
        dragState.fixed = wordSel.anchor;
        dragState.active = false;
        return;
      }
    } else if (dragState.clickCount >= 3) {
      // Triple-click (or more): select the entire block.
      const blockSel = selectBlockAt(docStore.get(), anchor);
      if (blockSel) {
        selStore.set(blockSel);
        dragState.fixed = blockSel.anchor;
        dragState.active = false;
        dragState.clickCount = 3;
        return;
      }
    }

    // Single-click: collapse to caret + start drag selection.
    selStore.set(caret(anchor));
    dragState.fixed = anchor;
    dragState.active = true;
  };

  // EditorView — root container, holds DocView + HiddenInput.
  const EditorView: PublicView<EditorViewProps, void> = view<EditorViewProps>(
    ({ props, use }) => {
      const doc = use(docStore);

      return {
        onMount() {
          const ta = document.querySelector(
            `textarea[data-creo-input="${editorId}"]`,
          ) as HTMLTextAreaElement | null;
          if (!ta) return;
          pipeline = attachInputPipeline(
            ta,
            { docStore, selStore },
            {
              record: (tag) => history.record(tag),
              undo: () => history.undo(),
              redo: () => history.redo(),
              selectAll: () => handleSelectAll(),
              rootForMeasure: () =>
                document.querySelector(
                  `[data-creo-editor="${editorId}"]`,
                ) as HTMLElement | null,
            },
          );
          clipboard = attachClipboard(
            ta,
            { docStore, selStore },
            { upload: opts.uploadImage },
          );
          const root = document.querySelector(
            `[data-creo-editor="${editorId}"]`,
          ) as HTMLElement | null;
          if (root) {
            drop = attachDrop(root, { docStore, selStore }, opts.uploadImage);
            viewport = attachVisualViewport(root, { docStore, selStore });
            // Mouse/touch drag-select: while a drag is active, every
            // pointermove updates the FOCUS side of the range. We listen
            // on `window` (not the editor root) so a drag that wanders
            // outside the editor still tracks correctly — same pattern as
            // text-selection in any native editable.
            const onWinMove = (e: PointerEvent) => {
              if (!dragState.active || !dragState.fixed) return;
              const r = root.getBoundingClientRect();
              // Clamp the focus point to within the root so dragging into
              // the toolbar / above the editor still produces a usable
              // anchor at the editor edge.
              const x = Math.max(r.left + 1, Math.min(r.right - 1, e.clientX));
              const y = Math.max(r.top + 1, Math.min(r.bottom - 1, e.clientY));
              const focusAnchor = pointToAnchor(docStore.get(), root, x, y);
              if (!focusAnchor) return;
              selStore.set({
                kind: "range",
                anchor: dragState.fixed,
                focus: focusAnchor,
              });
            };
            const onWinUp = () => {
              dragState.active = false;
            };
            window.addEventListener("pointermove", onWinMove);
            window.addEventListener("pointerup", onWinUp);
            // Also listen for double / triple click directly via dblclick
            // — some browsers don't reliably re-fire pointerdown on the
            // 2nd / 3rd click of a chain.
            root.addEventListener("dblclick", (ev) => {
              const e = ev as MouseEvent;
              const anchor = pointToAnchor(docStore.get(), root, e.clientX, e.clientY);
              if (!anchor) return;
              const wordSel = selectWordAt(docStore.get(), anchor);
              if (wordSel) selStore.set(wordSel);
            });
            // Suppress the browser's default mousedown behaviour on the
            // editor root: clicking a non-focusable element blurs the
            // currently focused input by default — which would un-focus our
            // textarea immediately after pointerdown focused it. Every
            // serious editor (ProseMirror, CodeMirror, Slate) does this.
            // We attach via a raw listener because Creo's event map only
            // exposes pointerdown / click, not mousedown.
            root.addEventListener("mousedown", (e) => {
              if (e.target instanceof HTMLElement) {
                const t = e.target.tagName;
                // Don't preventDefault on real inputs / buttons that need
                // native focus handling.
                if (t === "INPUT" || t === "BUTTON" || t === "SELECT" || t === "TEXTAREA") {
                  return;
                }
              }
              e.preventDefault();
              pipeline?.focus();
            });
          }
        },
        render() {
          const modeCls =
            opts.mode === "mono" ? " creo-editor-mono" : " creo-editor-regular";
          const cls =
            (props()?.class
              ? `creo-editor ${props()!.class}`
              : "creo-editor") + modeCls;
          div(
            {
              class: cls,
              "data-creo-editor": editorId,
              // `cursor: text` so hovering the editor shows the I-beam
              // (standard text-editor UX). Image blocks override this in
              // their own view to keep the default pointer arrow.
              //
              // `white-space: pre-wrap` is REQUIRED for editor correctness:
              // the default `white-space: normal` collapses trailing spaces
              // visually, so typing space at end-of-line would advance the
              // model offset but never show. The CSS property inherits, so
              // every descendant block uses pre-wrap unless it overrides.
              style:
                "position:relative;cursor:text;white-space:pre-wrap;",
              onPointerDown: handleRootPointerDown,
            },
            () => {
              if (opts.virtualized) {
                VirtualDoc({
                  docStore,
                  selStore,
                  estimatedHeight: opts.virtualEstimatedHeight,
                });
              } else {
                DocView({ doc: doc.get() });
              }
              CaretOverlay({ editorId, selStore, docStore });
              SelectionHandles({ editorId, selStore, docStore });
              MobileToolbar({
                editorId,
                selStore,
                docStore,
                onCopy: handleCopy,
                onCut: handleCut,
                onPaste: handlePaste,
                onSelectAll: handleSelectAll,
                onBold: () => dispatch({ t: "toggleMark", mark: "b" }),
                onItalic: () => dispatch({ t: "toggleMark", mark: "i" }),
              });
              HiddenInput({ editorId });
            },
          );
          void _;
        },
      };
    },
  );

  return {
    docStore,
    selStore,
    dispatch,
    undo,
    redo,
    EditorView,
    setDocFromHTML,
    toJSON,
    focus,
    blur,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedEmpty(): DocState {
  // A fresh editor needs at least one empty paragraph so the user has
  // something to type into.
  const block: BlockSpec = {
    id: newBlockId(),
    type: "p",
    runs: [],
  };
  return docFromBlocks([block]);
}

// Re-export emptyDoc for convenience.
export { emptyDoc };
