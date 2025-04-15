import { creo } from "../../creo";
import { n } from "../../engine/LayoutEngine";

export const VStack = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    n("div", c.p, c.slot);
  },
  // TODO allow `with` field to enable the `slot`
}));
