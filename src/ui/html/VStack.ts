import { creo, ui } from "../../creo";

export const VStack = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    ui("div", c.p, c.slot);
  },
  // TODO allow `with` field to enable the `slot`
}));
