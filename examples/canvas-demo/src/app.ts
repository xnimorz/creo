import { view } from "@/public/view";
import { div, text, button, span } from "@/public/primitives/primitives";

const Counter = view(({ use }) => {
  const count = use(0);
  const increment = () => count.update(n => n + 1);
  const decrement = () => count.update(n => n - 1);

  return {
    render() {
      div({ class: "counter" }, () => {
        button({ class: "btn", onClick: decrement }, () => {
          text("-");
        });
        span({ class: "count" }, () => {
          text(count.get());
        });
        button({ class: "btn", onClick: increment }, () => {
          text("+");
        });
      });
    },
  };
});

const Card = view<{ title: string }>(({ props, slot }) => ({
  render() {
    div({ class: "card" }, () => {
      div({ class: "card-header" }, () => {
        text(props().title);
      });
      div({ class: "card-body" }, slot);
    });
  },
}));

export const App = view(() => ({
  render() {
    div({ class: "root" }, () => {
      div({ class: "title" }, () => {
        text("Canvas Renderer Demo");
      });

      Card({ title: "Counter" }, () => {
        Counter();
      });

      Card({ title: "Static Content" }, () => {
        div({ class: "row" }, () => {
          div({ class: "box box-red" }, () => { text("Red"); });
          div({ class: "box box-green" }, () => { text("Green"); });
          div({ class: "box box-blue" }, () => { text("Blue"); });
        });
      });
    });
  },
}));
