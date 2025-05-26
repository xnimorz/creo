import { creo, ui } from "../../creo";
import { Maybe } from "../../data-structures/maybe/Maybe";
import { Node } from "../../engine/Node";

export const Button = creo<
  {
    // TODO replace with nice UI params
    [key: string]: string;
  },
  { getButton: () => HTMLButtonElement }
>((c) => {
  let button: Maybe<Node<void>>;
  return {
    render() {
      button = ui("button", c.p, c.slot);
    },
    getButton(): HTMLButtonElement {
      return button?.getUINode() as HTMLButtonElement;
    },
  };
});
