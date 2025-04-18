import { creo, ui } from "../../creo";

export const Text = creo<string>((c) => {
  return {
    render() {
      ui("text", c.p);
    },
  };
});
