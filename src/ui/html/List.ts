import { creo } from "../../creo";

export const List = creo<{
  // TODO replace with nice UI params
  [key: string]: string;
}>((c) => ({
  render() {
    c.e("div", c.p, c.slot);
  },
}));
