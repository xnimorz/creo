import { createApp, view, div, h2, p, button, HtmlRender, _, text } from "creo";

type Quote = { quote: string; author: string };

const RandomQuote = view(({ use }) => {
  const quote = use<Quote | null>(null);
  const loading = use(false);
  const error = use<string | null>(null);

  const load = async () => {
    loading.set(true);
    error.set(null);
    try {
      const r = await fetch("https://dummyjson.com/quotes/random");
      if (!r.ok) throw new Error(`${r.status}`);
      quote.set(await r.json());
    } catch (e) {
      error.set((e as Error).message);
    } finally {
      loading.set(false);
    }
  };

  return {
    onMount: load,
    render() {
      div({ class: "card" }, () => {
        h2(_, "Random quote");

        if (loading.get()) {
          p({ class: "muted" }, () => text("Loading…"));
        } else if (error.get()) {
          p({ class: "error" }, error.get()!);
        } else if (quote.get()) {
          const q = quote.get()!;
          p({ class: "quote" }, `"${q.quote}"`);
          p({ class: "author" }, `— ${q.author}`);
        }

        button({ onClick: load, disabled: loading.get() }, "Get another");
      });
    },
  };
});

createApp(
  () => RandomQuote(),
  new HtmlRender(document.getElementById("app")!),
).mount();
