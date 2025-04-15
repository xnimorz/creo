import { creo } from "../../creo";

export const Inline = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => {
  return {
    render() {
      c.e("span", c.p, c.slot);
    },
  };
});
