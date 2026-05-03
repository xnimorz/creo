import { h1, h2, h3, h4, h5, h6, view } from "creo";
import type { HeadingBlock } from "../../model/types";
import { InlineRunsView } from "../InlineRunsView";

const TAG = { h1, h2, h3, h4, h5, h6 } as const;

export const HeadingView = view<{ block: HeadingBlock }>(({ props }) => ({
  shouldUpdate(next) {
    return next.block !== props().block;
  },
  render() {
    const b = props().block;
    const tag = TAG[b.type];
    tag(
      { "data-block-id": b.id, class: `ce-block ce-${b.type}` },
      () => {
        InlineRunsView({ runs: b.runs });
      },
    );
  },
}));
