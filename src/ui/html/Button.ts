import { creo } from "../../creo";
import { n } from "../../engine/LayoutEngine";

export const Button = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    n("button", c.p, c.slot);
  },
}));
