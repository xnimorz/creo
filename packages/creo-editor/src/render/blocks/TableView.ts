import { table, tbody, td, tr, view } from "creo";
import type { TableBlock } from "../../model/types";
import { InlineRunsView } from "../InlineRunsView";

/**
 * Render a TableBlock as <table><tbody>… with keyed rows + cells.
 *
 * Cell DOM has data-block-id="<blockId>" so the caret/measurement code can
 * locate the owning block, plus data-cell="<r>:<c>" so pointToAnchor can
 * recover (row, col).
 */
export const TableView = view<{ block: TableBlock }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    // NOTE: intermediate primitives (tbody, tr) get FRESH prop objects each
    // render, not the `_` no-props constant. The reconciler skips descent
    // when an intermediate primitive's props are reference-equal to the
    // previous render — using `_` everywhere causes that shortcut to fire
    // and changes inside cells (e.g. typed text) never make it to the DOM.
    table(
      {
        "data-block-id": b.id,
        class: "ce-block ce-table",
      },
      () => {
        tbody({}, () => {
          for (let r = 0; r < b.rows; r++) {
            tr({ key: `r${r}`, "data-row": String(r) }, () => {
              for (let c = 0; c < b.cols; c++) {
                const runs = b.cells[r]?.[c] ?? [];
                td(
                  {
                    key: `${r}-${c}`,
                    class: "ce-cell",
                    "data-block-id": b.id,
                    "data-cell": `${r}:${c}`,
                  },
                  () => {
                    InlineRunsView({ runs });
                  },
                );
              }
            });
          }
        });
      },
    );
  },
}));
