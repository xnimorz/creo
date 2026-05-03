import { _ } from "creo";
import { ol, ul, view } from "creo";
import type { Block, DocState, ListItemBlock } from "../model/types";
import { ColumnsView } from "./blocks/ColumnsView";
import { HeadingView } from "./blocks/HeadingView";
import { ImageView } from "./blocks/ImageView";
import { ListItemView } from "./blocks/ListItemView";
import { ParagraphView } from "./blocks/ParagraphView";
import { TableView } from "./blocks/TableView";

/**
 * BlockView — single dispatch view, switches on block.type.
 *
 * `shouldUpdate` is an identity check on `block`. Because doc updates produce
 * a fresh top-level DocState but reuse references for unchanged blocks, this
 * lets the reconciler skip every block that wasn't touched.
 */
const BlockView = view<{ block: Block }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    switch (b.type) {
      case "p":
        ParagraphView({ block: b, key: b.id });
        return;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        HeadingView({ block: b, key: b.id });
        return;
      case "li":
        ListItemView({ block: b, key: b.id });
        return;
      case "table":
        TableView({ block: b, key: b.id });
        return;
      case "columns":
        ColumnsView({ block: b, key: b.id });
        return;
      case "img":
        ImageView({ block: b, key: b.id });
        return;
    }
  },
}));

/**
 * Group consecutive `li` blocks of the same `ordered` flag into a single
 * `<ul>`/`<ol>`. Returns spans `[start, end)` over `doc.order`.
 */
type Span = { kind: "single"; pos: number } | {
  kind: "list";
  ordered: boolean;
  start: number;
  end: number;
};

function planSpans(doc: DocState): Span[] {
  const out: Span[] = [];
  let i = 0;
  while (i < doc.order.length) {
    const block = doc.byId.get(doc.order[i]!)!;
    if (block.type === "li") {
      const ordered = (block as ListItemBlock).ordered;
      let j = i + 1;
      while (j < doc.order.length) {
        const b2 = doc.byId.get(doc.order[j]!)!;
        if (b2.type !== "li") break;
        if ((b2 as ListItemBlock).ordered !== ordered) break;
        j++;
      }
      out.push({ kind: "list", ordered, start: i, end: j });
      i = j;
    } else {
      out.push({ kind: "single", pos: i });
      i++;
    }
  }
  return out;
}

export const DocView = view<{ doc: DocState }>(({ props }) => ({
  shouldUpdate(next) {
    return next.doc !== props().doc;
  },
  render() {
    const doc = props().doc;
    const spans = planSpans(doc);
    for (const span of spans) {
      if (span.kind === "single") {
        const b = doc.byId.get(doc.order[span.pos]!)!;
        BlockView({ block: b, key: b.id });
      } else {
        // Group key spans the included ids — stable as long as the same
        // contiguous run keeps the same start/end ids in order.
        const firstId = doc.order[span.start]!;
        const lastId = doc.order[span.end - 1]!;
        const groupKey = `list:${span.ordered ? "o" : "u"}:${firstId}:${lastId}`;
        const renderItems = () => {
          for (let i = span.start; i < span.end; i++) {
            const b = doc.byId.get(doc.order[i]!)!;
            BlockView({ block: b, key: b.id });
          }
        };
        if (span.ordered) {
          ol({ class: "ce-list", key: groupKey }, renderItems);
        } else {
          ul({ class: "ce-list", key: groupKey }, renderItems);
        }
      }
    }
    void _;
  },
}));
