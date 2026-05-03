import { div, view } from "creo";
import type { ColumnsBlock } from "../../model/types";
import { InlineRunsView } from "../InlineRunsView";

/**
 * Render a ColumnsBlock as a flex row of equal-width column divs. Each
 * column carries `data-block-id` (so caret-overlay queries find the owner)
 * AND `data-col="<index>"` so pointToAnchor can reconstruct the column.
 *
 * NOTE: intermediate primitives use fresh `{}` props (not the `_` no-props
 * constant) — same workaround we apply in TableView. The reconciler's
 * primitive shortcut skips descent when an intermediate primitive's props
 * are reference-equal to the previous render, which would otherwise leave
 * cell text edits invisible.
 */
export const ColumnsView = view<{ block: ColumnsBlock }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    div(
      {
        "data-block-id": b.id,
        class: "ce-block ce-columns",
        style: `display:grid;grid-template-columns:repeat(${b.cols},1fr);gap:16px;`,
      },
      () => {
        for (let c = 0; c < b.cols; c++) {
          const runs = b.cells[c] ?? [];
          div(
            {
              key: `col-${c}`,
              class: "ce-col",
              "data-block-id": b.id,
              "data-col": String(c),
              style: "min-width:0;",
            },
            () => {
              InlineRunsView({ runs });
            },
          );
        }
      },
    );
  },
}));
