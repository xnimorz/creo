import { describe, it, expect } from "bun:test";
import { Window } from "happy-dom";
import { view } from "@/public/view";
import {
  div, span, text, button, input, a, img, h1, h2, p, ul, ol, li,
  nav, header, footer, section, article, label, textarea, select, option,
  table, thead, tbody, tr, th, td, br, hr, form, strong, em, code, pre,
  dl, dt, dd,
} from "@/public/primitives/primitives";
import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "./html_render";
import { HtmlStringRender } from "./string_render";
import type { Wildcard } from "@/internal/wildcard";
import { _ } from "@/functional/maybe";

// ---------------------------------------------------------------------------
// Happy-dom setup
// ---------------------------------------------------------------------------

const win = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  document: win.document,
  HTMLElement: win.HTMLElement,
  Text: win.Text,
  HTMLImageElement: win.HTMLImageElement,
  HTMLInputElement: win.HTMLInputElement,
  DocumentFragment: win.DocumentFragment,
  Comment: win.Comment,
  Node: win.Node,
  Event: win.Event,
});

// ---------------------------------------------------------------------------
// Helper: render the same view with both renderers, compare output
// ---------------------------------------------------------------------------

function assertParity(appView: (props?: any, slot?: any) => void) {
  // HtmlStringRender
  const sr = new HtmlStringRender();
  const se = new Engine(sr);
  orchestrator.setCurrentEngine(se);
  se.createRoot(() => appView(), {});
  se.render();
  const stringOutput = sr.renderToString();

  // HtmlRender
  const container = win.document.createElement("div") as unknown as HTMLElement;
  const hr = new HtmlRender(container);
  const he = new Engine(hr);
  orchestrator.setCurrentEngine(he);
  he.createRoot(() => appView(), {});
  he.render();
  const domOutput = (container as any).innerHTML;

  expect(stringOutput).toBe(domOutput);
  return stringOutput;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Renderer Parity — HtmlRender vs HtmlStringRender", () => {
  // -- Basic elements -------------------------------------------------------

  describe("basic elements", () => {
    it("single div with class", () => {
      const App = view(() => ({
        render() { div({ class: "root" }); },
      }));
      const html = assertParity(App);
      expect(html).toContain('class="root"');
    });

    it("nested divs", () => {
      const App = view(() => ({
        render() {
          div({ class: "outer" }, () => {
            div({ class: "inner" }, () => {
              text("hello");
            });
          });
        },
      }));
      assertParity(App);
    });

    it("empty element", () => {
      const App = view(() => ({
        render() { div(_); },
      }));
      assertParity(App);
    });

    it("element with no props", () => {
      const App = view(() => ({
        render() {
          div(_, () => { span(_, "test"); });
        },
      }));
      assertParity(App);
    });
  });

  // -- Text content ---------------------------------------------------------

  describe("text content", () => {
    it("plain text", () => {
      const App = view(() => ({
        render() { text("hello world"); },
      }));
      assertParity(App);
    });

    it("numeric text", () => {
      const App = view(() => ({
        render() { text(42); },
      }));
      assertParity(App);
    });

    it("text with HTML special characters", () => {
      const App = view(() => ({
        render() { text('<script>alert("xss")</script>'); },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("text with ampersand", () => {
      const App = view(() => ({
        render() { text("Tom & Jerry"); },
      }));
      const html = assertParity(App);
      expect(html).toContain("&amp;");
    });

    it("multiple text nodes as siblings", () => {
      const App = view(() => ({
        render() {
          div(_, () => {
            text("one");
            text("two");
            text("three");
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- Attributes -----------------------------------------------------------

  describe("attributes", () => {
    it("class attribute", () => {
      const App = view(() => ({
        render() { div({ class: "foo bar" }); },
      }));
      const html = assertParity(App);
      expect(html).toContain('class="foo bar"');
    });

    it("id attribute", () => {
      const App = view(() => ({
        render() { div({ id: "main" }); },
      }));
      const html = assertParity(App);
      expect(html).toContain('id="main"');
    });

    it("multiple attributes", () => {
      const App = view(() => ({
        render() {
          a({ href: "/about", class: "link", title: "About page" }, () => {
            text("About");
          });
        },
      }));
      const html = assertParity(App);
      expect(html).toContain('href="/about"');
      expect(html).toContain('class="link"');
      expect(html).toContain('title="About page"');
    });

    it("attribute with special characters", () => {
      const App = view(() => ({
        render() { div({ title: 'He said "hello" & waved' }); },
      }));
      const html = assertParity(App);
      expect(html).toContain("&quot;");
      expect(html).toContain("&amp;");
    });

    it("boolean attribute true", () => {
      const App = view(() => ({
        render() { div({ hidden: true }); },
      }));
      const html = assertParity(App);
      expect(html).toContain("hidden");
    });

    it("boolean attribute false is omitted", () => {
      const App = view(() => ({
        render() { div({ hidden: false }); },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("hidden");
    });

    it("style attribute", () => {
      const App = view(() => ({
        render() { div({ style: "color: red; font-size: 14px" }); },
      }));
      assertParity(App);
    });

    it("data attributes", () => {
      const App = view(() => ({
        render() { div({ "data-testid": "my-div", "data-value": "123" }); },
      }));
      const html = assertParity(App);
      expect(html).toContain('data-testid="my-div"');
      expect(html).toContain('data-value="123"');
    });

    it("null/undefined attributes are omitted", () => {
      const App = view(() => ({
        render() { div({ class: "yes", id: null as any, title: undefined as any }); },
      }));
      const html = assertParity(App);
      expect(html).toContain("class");
      expect(html).not.toContain("id");
      expect(html).not.toContain("title");
    });

    it("key attribute is omitted from output", () => {
      const App = view(() => ({
        render() { div({ key: "my-key", class: "item" }); },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("my-key");
      expect(html).toContain("class");
    });
  });

  // -- Event handlers -------------------------------------------------------

  describe("event handlers", () => {
    it("event handlers are omitted from HTML output", () => {
      const App = view(() => ({
        render() {
          button({ class: "btn", onClick: () => {} }, "Click");
        },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("onClick");
      expect(html).not.toContain("function");
      expect(html).toContain('class="btn"');
    });

    it("multiple event handlers omitted", () => {
      const App = view(() => ({
        render() {
          input({
            type: "text",
            onInput: () => {},
            onKeyDown: () => {},
            onFocus: () => {},
            onBlur: () => {},
          });
        },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("onInput");
      expect(html).toContain('type="text"');
    });
  });

  // -- Void elements --------------------------------------------------------

  describe("void elements", () => {
    it("input element", () => {
      const App = view(() => ({
        render() { input({ type: "text", placeholder: "Enter..." }); },
      }));
      const html = assertParity(App);
      expect(html).toContain("input");
      expect(html).toContain('type="text"');
    });

    it("img element", () => {
      const App = view(() => ({
        render() { img({ src: "logo.png", alt: "Logo" }); },
      }));
      const html = assertParity(App);
      expect(html).toContain("src=");
      expect(html).toContain("alt=");
    });

    it("br element", () => {
      const App = view(() => ({
        render() {
          div(_, () => { text("line1"); br(_); text("line2"); });
        },
      }));
      assertParity(App);
    });

    it("hr element", () => {
      const App = view(() => ({
        render() { hr(_); },
      }));
      assertParity(App);
    });
  });

  // -- Composites -----------------------------------------------------------

  describe("composites", () => {
    it("composite is transparent in output", () => {
      const Inner = view(() => ({
        render() { span(_, "inner"); },
      }));

      const App = view(() => ({
        render() {
          div({ class: "outer" }, () => { Inner(); });
        },
      }));
      const html = assertParity(App);
      expect(html).not.toContain("composite");
      expect(html).toContain("inner");
    });

    it("nested composites", () => {
      const C = view(() => ({ render() { text("deep"); } }));
      const B = view(() => ({ render() { span(_, () => C()); } }));
      const A = view(() => ({ render() { div(_, () => B()); } }));
      const App = view(() => ({ render() { A(); } }));
      assertParity(App);
    });

    it("composite with slot", () => {
      const Card = view<{ title: string }>(({ props, slot }) => ({
        render() {
          div({ class: "card" }, () => {
            h1(_, () => text(props().title));
            div({ class: "body" }, slot);
          });
        },
      }));

      const App = view(() => ({
        render() {
          Card({ title: "Hello" }, () => {
            p(_, "content");
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- Lists ----------------------------------------------------------------

  describe("lists", () => {
    it("unordered list", () => {
      const App = view(() => ({
        render() {
          ul(_, () => {
            li(_, "one");
            li(_, "two");
            li(_, "three");
          });
        },
      }));
      assertParity(App);
    });

    it("keyed list", () => {
      const items = [
        { id: 1, label: "Alpha" },
        { id: 2, label: "Beta" },
        { id: 3, label: "Gamma" },
      ];
      const App = view(() => ({
        render() {
          ul(_, () => {
            for (const item of items) {
              li({ key: item.id }, () => text(item.label));
            }
          });
        },
      }));
      assertParity(App);
    });

    it("table with rows", () => {
      const App = view(() => ({
        render() {
          table(_, () => {
            thead(_, () => {
              tr(_, () => {
                th(_, "Name");
                th(_, "Age");
              });
            });
            tbody(_, () => {
              tr(_, () => {
                td(_, "Alice");
                td(_, "30");
              });
              tr(_, () => {
                td(_, "Bob");
                td(_, "25");
              });
            });
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- Semantic elements ----------------------------------------------------

  describe("semantic elements", () => {
    it("nav with links", () => {
      const App = view(() => ({
        render() {
          nav({ class: "main-nav" }, () => {
            a({ href: "/" }, "Home");
            a({ href: "/about" }, "About");
          });
        },
      }));
      assertParity(App);
    });

    it("article with header/footer", () => {
      const App = view(() => ({
        render() {
          article(_, () => {
            header(_, () => h1(_, "Title"));
            section(_, () => p(_, "Body"));
            footer(_, "Footer");
          });
        },
      }));
      assertParity(App);
    });

    it("definition list", () => {
      const App = view(() => ({
        render() {
          dl(_, () => {
            dt(_, "Term");
            dd(_, "Definition");
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- Form elements --------------------------------------------------------

  describe("form elements", () => {
    it("form with labeled input", () => {
      const App = view(() => ({
        render() {
          form(_, () => {
            label(_, "Name:");
            input({ type: "text", placeholder: "Enter name" });
          });
        },
      }));
      assertParity(App);
    });

    it("textarea", () => {
      const App = view(() => ({
        render() { textarea({ class: "editor", rows: "5" as any }); },
      }));
      assertParity(App);
    });

    it.skip("select with options (happy-dom querySelectorAll bug)", () => {
      const App = view(() => ({
        render() {
          select(_, () => {
            option({ value: "a" }, "Alpha");
            option({ value: "b" }, "Beta");
          });
        },
      }));
      assertParity(App);
    });

    it("autofocus boolean attribute", () => {
      const App = view(() => ({
        render() { input({ type: "text", autofocus: true }); },
      }));
      assertParity(App);
    });
  });

  // -- Inline formatting ----------------------------------------------------

  describe("inline formatting", () => {
    it("strong and em", () => {
      const App = view(() => ({
        render() {
          p(_, () => {
            text("This is ");
            strong(_, "bold");
            text(" and ");
            em(_, "italic");
          });
        },
      }));
      assertParity(App);
    });

    it("code and pre", () => {
      const App = view(() => ({
        render() {
          pre(_, () => {
            code(_, "const x = 1;");
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- Complex real-world scenarios -----------------------------------------

  describe("real-world scenarios", () => {
    it("todo app structure", () => {
      const TodoItem = view<{ text: string; done: boolean }>(({ props }) => ({
        render() {
          div({ class: props().done ? "todo done" : "todo" }, () => {
            span({ class: "check", onClick: () => {} }, () => {
              text(props().done ? "[x]" : "[ ]");
            });
            span({ class: "label" }, () => text(props().text));
            button({ class: "delete", onClick: () => {} }, "x");
          });
        },
      }));

      const App = view(() => ({
        render() {
          div({ class: "app" }, () => {
            h1(_, "Todos");
            div({ class: "list" }, () => {
              TodoItem({ key: "1", text: "Buy milk", done: false });
              TodoItem({ key: "2", text: "Walk dog", done: true });
              TodoItem({ key: "3", text: "Code", done: false });
            });
          });
        },
      }));
      assertParity(App);
    });

    it("nav bar with active link", () => {
      const Link = view<{ href: string; active: boolean }>(({ props, slot }) => ({
        render() {
          a({ href: props().href, class: props().active ? "active" : "" }, slot);
        },
      }));

      const App = view(() => ({
        render() {
          nav({ class: "navbar" }, () => {
            Link({ href: "/", active: true }, "Home");
            Link({ href: "/about", active: false }, "About");
            Link({ href: "/users", active: false }, "Users");
          });
        },
      }));
      assertParity(App);
    });

    it("conditional rendering", () => {
      const App = view(() => ({
        render() {
          div(_, () => {
            if (true) {
              div({ class: "shown" }, "visible");
            }
            if (false) {
              div({ class: "hidden" }, "invisible");
            }
          });
        },
      }));
      assertParity(App);
    });

    it("deeply nested structure", () => {
      const App = view(() => ({
        render() {
          div({ class: "l1" }, () => {
            div({ class: "l2" }, () => {
              div({ class: "l3" }, () => {
                div({ class: "l4" }, () => {
                  div({ class: "l5" }, () => {
                    text("deep");
                  });
                });
              });
            });
          });
        },
      }));
      assertParity(App);
    });

    it("mixed content: elements, text, composites", () => {
      const Badge = view<{ label: string }>(({ props }) => ({
        render() {
          span({ class: "badge" }, () => text(props().label));
        },
      }));

      const App = view(() => ({
        render() {
          div({ class: "profile" }, () => {
            h2(_, "User Profile");
            p(_, () => {
              text("Name: ");
              strong(_, "Alice");
            });
            p(_, () => {
              text("Tags: ");
              Badge({ label: "admin" });
              text(" ");
              Badge({ label: "active" });
            });
            hr(_);
            p(_, "Footer text");
          });
        },
      }));
      assertParity(App);
    });
  });

  // -- String slots -----------------------------------------------------------

  describe("string slots", () => {
    it("string slot on primitive", () => {
      const App = view(() => ({
        render() {
          span({ class: "label" }, "hello");
        },
      }));
      const html = assertParity(App);
      expect(html).toContain("hello");
    });

    it("string slot produces same output as function slot with text()", () => {
      const AppString = view(() => ({
        render() {
          div({ class: "a" }, "hello");
        },
      }));
      const AppFunc = view(() => ({
        render() {
          div({ class: "a" }, () => { text("hello"); });
        },
      }));
      const htmlString = assertParity(AppString);
      const htmlFunc = assertParity(AppFunc);
      expect(htmlString).toBe(htmlFunc);
    });

    it("string slot on composite view", () => {
      const Card = view<{ title: string }>(({ props, slot }) => ({
        render() {
          div({ class: "card" }, () => {
            h1(_, () => text(props().title));
            div({ class: "body" }, slot);
          });
        },
      }));

      const App = view(() => ({
        render() {
          Card({ title: "Title" }, "card content");
        },
      }));
      const html = assertParity(App);
      expect(html).toContain("Title");
      expect(html).toContain("card content");
    });

    it("mixed string and function slots", () => {
      const App = view(() => ({
        render() {
          div({ class: "a" }, "text slot");
          div({ class: "b" }, () => {
            span(_, "nested");
            text(" and more");
          });
        },
      }));
      assertParity(App);
    });
  });
});
