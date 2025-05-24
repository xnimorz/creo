import { creo, ui } from "../../creo";

export const Button = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    const value = ui("button", c.p, c.slot);
    console.log(value);
  },
}));
