import { creo, ui } from "../../creo";

export const Button = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    ui("button", c.p, c.slot);
  },
}));
