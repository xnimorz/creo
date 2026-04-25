import { createApp, view, button, div, text, HtmlRender, _ } from "creo";

const Counter = view<{ initial: number }>(({ props, use }) => {
  const count = use(props().initial);
  const inc = () => count.update((n) => n + 1);
  const dec = () => count.update((n) => n - 1);
  const reset = () => count.set(props().initial);

  return {
    render() {
      div({ class: "counter" }, () => {
        div({ class: "count" }, String(count.get()));
        div({ class: "controls" }, () => {
          button({ onClick: dec }, "−");
          button({ onClick: reset }, "reset");
          button({ onClick: inc }, "+");
        });
      });
    },
  };
});

createApp(
  () => Counter({ initial: 0 }),
  new HtmlRender(document.getElementById("app")!),
).mount();
