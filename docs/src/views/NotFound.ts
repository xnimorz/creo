import { view, div, h1, p, a, _ } from "creo";

export const NotFound = view(() => ({
  render() {
    div({ class: "not-found" }, () => {
      h1(_, "404");
      p(_, "That page does not exist.");
      a({ href: "#/", class: "btn btn-ghost" }, "Back home");
    });
  },
}));
