import { createApp, view, div, store, button, span, HtmlRender, _, } from "creo";

// Global store — any view can subscribe and update
const ThemeStore = store.new<"light" | "dark">("light");
const CountStore = store.new(0);

const Display = view(({ use }) => {
  const theme = use(ThemeStore);
  const count = use(CountStore);

  return {
    render() {
      div({ class: "display", "data-theme": theme.get() }, () => {
        span({ class: "label" }, "Count:");
        span({ class: "value" }, String(count.get()));
      });
    },
  };
});

const Controls = view(() => {
  const bump = () => CountStore.update((n) => n + 1);
  const flip = () =>
    ThemeStore.update((t) => (t === "light" ? "dark" : "light"));

  return {
    render() {
      div({ class: "controls" }, () => {
        button({ onClick: bump }, "Bump count");
        button({ onClick: flip }, "Flip theme");
      });
    },
  };
});

const App = view(() => ({
  render() {
    div({ class: "shell" }, () => {
      Display();
      Controls();
    });
  },
}));

createApp(() => App(), new HtmlRender(document.getElementById("app")!)).mount();
