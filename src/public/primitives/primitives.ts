import { view } from "../view";

export type DivAttrs = {};

export type Events = {
  on: () => void;
};

export const div = view<DivAttrs, Events, "div">(({ props, slot }) => ({
  tag: "div",
}));
