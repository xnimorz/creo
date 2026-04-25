import { createApp, view, div, p, h2, button, HtmlRender, _, } from "creo";

type Quote = { quote: string; author: string };

type SuspenseProps = {
  load: () => Promise<Quote>;
  children: (data: Quote) => void;
  fallback?: string;
  key?: unknown;
};

type Status = "loading" | "ok" | "error";

const Suspense = view<SuspenseProps>(({ props, use }) => {
  const status = use<Status>("loading");
  const data = use<Quote | null>(null);
  const err = use<Error | null>(null);

  const run = async () => {
    status.set("loading");
    try {
      data.set(await props().load());
      status.set("ok");
    } catch (e) {
      err.set(e as Error);
      status.set("error");
    }
  };

  return {
    onMount: run,
    render() {
      switch (status.get()) {
        case "loading":
          p({ class: "muted" }, props().fallback ?? "Loading…");
          return;
        case "error":
          p({ class: "error" }, err.get()!.message);
          return;
        case "ok":
          props().children(data.get()!);
          return;
      }
    },
  };
});

const loadQuote = async (): Promise<Quote> => {
  const r = await fetch("https://dummyjson.com/quotes/random");
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const App = view(({ use }) => {
  const reloadKey = use(0);
  const reload = () => reloadKey.update((n) => n + 1);

  return {
    render() {
      div({ class: "card" }, () => {
        h2(_, "Random quote");

        Suspense({
          key: reloadKey.get(),
          load: loadQuote,
          fallback: "Loading…",
          children: (q) => {
            p({ class: "quote" }, `"${q.quote}"`);
            p({ class: "author" }, `— ${q.author}`);
          },
        });

        button({ onClick: reload }, "Get another");
      });
    },
  };
});

createApp(
  () => App(),
  new HtmlRender(document.getElementById("app")!),
).mount();
