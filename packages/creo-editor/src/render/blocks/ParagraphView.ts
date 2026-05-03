import { p, view } from "creo";
import type { ParagraphBlock } from "../../model/types";
import { InlineRunsView } from "../InlineRunsView";

export const ParagraphView = view<{ block: ParagraphBlock }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    p({ "data-block-id": b.id, class: "ce-block ce-p" }, () => {
      InlineRunsView({ runs: b.runs });
    });
  },
}));
