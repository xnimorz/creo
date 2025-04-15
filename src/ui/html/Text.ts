import { creo } from "../../creo";
import { n } from "../../engine/LayoutEngine";

export const Text = creo<string>((c) => {
  return {
    render() {
      n("text", c.p);
    },
  };
});
