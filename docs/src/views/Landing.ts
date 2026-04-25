import {
  view,
  div,
  section,
  h1,
  h2,
  h3,
  p,
  a,
  span,
  pre,
  code,
  text,
  _,
} from "creo";
import { RawHtml } from "./RawHtml";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);

const HERO_SNIPPET = `import { createApp, view, button, text, HtmlRender } from "creo";

const Counter = view<{ initial: number }>(({ props, use }) => {
  const count = use(props().initial);
  const bump = () => count.update(n => n + 1);

  return {
    render() {
      button({ onClick: bump }, () => text(count.get()));
    },
  };
});

createApp(() => Counter({ initial: 0 }),
  new HtmlRender(document.getElementById("app")!)).mount();`;

const HERO_SNIPPET_HTML = hljs.highlight(HERO_SNIPPET, {
  language: "typescript",
}).value;

const features = [
  {
    title: '"Streaming" UI',
    text: "Views are plain function calls. All JavaScript control flow works: if, for, while, switch.",
  },
  {
    title: "Reactive state",
    text: "use() for local, store for global. Set immediately, read immediately — no stale closures.",
  },
  {
    title: "Explicit lifecycle",
    text: "Named hooks (onMount, onUpdateAfter) instead of useEffect dependency arrays.",
  },
  {
    title: "Pluggable renderers",
    text: "DOM, JSON AST, HTML string — or write your own by implementing IRender.",
  },
  {
    title: "Typed primitives",
    text: "Every HTML tag is a typed factory with events, attrs, and children.",
  },
  {
    title: "Tiny footprint",
    text: "No compiler, no template DSL, Small Size, Tree Shakeable",
  },
];

export const Landing = view(() => ({
  render() {
    div({ class: "landing" }, () => {
      section({ class: "hero" }, () => {
        div({ class: "hero-inner" }, () => {
          div({ class: "hero-copy" }, () => {
            h1(_, () => {
              text("Lightweight UI framework for ");
              span({ class: "hero-accent" }, "JavaScript");
              text(".");
            });
            p(
              { class: "hero-tagline" },
              "Framework which does not do magic or overwhelm you with rules. Simple, intuitive API, without added DSL",
            );

            div({ class: "hero-cta" }, () => {
              a(
                { href: "#/getting-started", class: "btn btn-primary" },
                "Get started",
              );
              a(
                { href: "#/playground", class: "btn btn-ghost" },
                "Open playground",
              );
            });
          });

          div({ class: "hero-code" }, () => {
            pre(_, () => {
              RawHtml({
                html: `<code class="hljs language-ts">${HERO_SNIPPET_HTML}</code>`,
              });
            });
          });
        });
      });

      section({ class: "features" }, () => {
        h2({ class: "section-title" }, "Why Creo");
        div({ class: "feature-grid" }, () => {
          for (const f of features) {
            div({ key: f.title, class: "feature-card" }, () => {
              h3(_, f.title);
              p(_, f.text);
            });
          }
        });
      });

      section({ class: "cta-strip" }, () => {
        div({ class: "cta-inner" }, () => {
          h2(_, "Try it in the playground");
          p(
            _,
            "Live-edit a component, see it render next to your code. No install required.",
          );
          a(
            { href: "#/playground", class: "btn btn-primary" },
            "Open playground",
          );
        });
      });
    });
  },
}));
