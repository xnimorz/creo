import { li, view } from "creo";
import type { ListItemBlock } from "../../model/types";
import { InlineRunsView } from "../InlineRunsView";

export const ListItemView = view<{ block: ListItemBlock }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    li(
      {
        "data-block-id": b.id,
        class: `ce-block ce-li ce-li-d${b.depth}`,
        "data-depth": String(b.depth),
      },
      () => {
        InlineRunsView({ runs: b.runs });
      },
    );
  },
}));
