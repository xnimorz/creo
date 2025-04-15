import { creo } from "../../creo";
import { n } from "../../engine/LayoutEngine";

export const Block = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    n("div", c.p, c.slot);
  },
}));
