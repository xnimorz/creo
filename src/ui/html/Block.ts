import { creo, ui } from "../../creo";

export const Block = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    ui("div", c.p, c.slot);
  },
}));
