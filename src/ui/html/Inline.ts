import { creo, ui } from "../../creo";

export const Inline = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => {
  return {
    render() {
      ui("span", c.p, c.slot);
    },
  };
});
