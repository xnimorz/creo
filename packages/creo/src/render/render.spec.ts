import { describe, it, expect, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import type { ViewFn } from "@/public/view";
import { view } from "@/public/view";
import { div, span, text, button, input, svg, html } from "@/public/primitives/primitives";
import type { Reactive } from "@/public/state";
import { store } from "@/public/store";
import { Engine } from "@/internal/engine";
import type { ViewRecord } from "@/internal/internal_view";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "./html_render";
import { JsonRender, type JsonNode } from "./json_render";
import { HtmlStringRender } from "./string_render";

import type { IRender } from "./render_interface";
import type { Wildcard } from "@/internal/wildcard";

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
// Todo app views
// ---------------------------------------------------------------------------

type TodoItem = { id: string; text: string; done: boolean; key?: string };

const TodoItemCall = view<TodoItem>((ctx) => ({
  render() {
    div({ class: ctx.props().done ? "todo done" : "todo" }, () => {
      span({ class: "text" }, () => {
        text(ctx.props().text);
      });
      button({ class: "delete" });
    });
  },
}));

// ---------------------------------------------------------------------------
// DOM helpers (happy-dom's getElementsByClassName is broken in this setup)
// ---------------------------------------------------------------------------

function findByClass(root: Node, cls: string): HTMLElement[] {
  const results: HTMLElement[] = [];
  function walk(node: Node) {
    if (
      node instanceof HTMLElement &&
      node.className.split(" ").includes(cls)
    ) {
      results.push(node);
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  }
  walk(root);
  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialItems(): TodoItem[] {
  return [
    { id: "1", text: "Buy milk", done: false },
    { id: "2", text: "Walk dog", done: true },
  ];
}

function createTodoApp(renderer: IRender<Wildcard>) {
  let itemsState: Reactive<TodoItem[]>;

  const TodoApp = view<void>(({ use }) => {
    const items = use<TodoItem[]>(initialItems());
    itemsState = items;
    return {
      render() {
        div({ class: "app" }, () => {
          for (const item of items.get()) {
            TodoItemCall({ ...item, key: item.id });
          }
        });
      },
    };
  });

  const engine = new Engine(renderer);
  orchestrator.setCurrentEngine(engine);
  const root = engine.createRoot(() => { TodoApp(); }, {});
  engine.render();

  return {
    engine,
    root,
    rerender(newItems: TodoItem[]) {
      itemsState!.set(newItems);
      engine.render();
    },
  };
}

// ---------------------------------------------------------------------------
// String Renderer
// ---------------------------------------------------------------------------

describe("HtmlStringRender", () => {
  let renderer: HtmlStringRender;
  let app: ReturnType<typeof createTodoApp>;

  beforeEach(() => {
    renderer = new HtmlStringRender();
    app = createTodoApp(renderer);
  });

  it("should render initial todo app", () => {
    const html = renderer.renderToString();
    expect(html).toContain("Buy milk");
    expect(html).toContain("Walk dog");
    expect(html).toContain("<div");
    expect(html).toContain("<span");
    expect(html).toContain("<button");
    expect(html).toContain('class="app"');
    expect(html).toContain('class="text"');
  });

  it("should re-render with updated items", () => {
    app.rerender([
      { id: "1", text: "Buy cheese", done: false },
      { id: "2", text: "Walk dog", done: true },
    ]);

    const html = renderer.renderToString();
    expect(html).toContain("Buy cheese");
    expect(html).not.toContain("Buy milk");
    expect(html).toContain("Walk dog");
  });

  it("should re-render after adding an item", () => {
    app.rerender([
      ...initialItems(),
      { id: "3", text: "Read book", done: false },
    ]);

    const html = renderer.renderToString();
    expect(html).toContain("Buy milk");
    expect(html).toContain("Walk dog");
    expect(html).toContain("Read book");
  });

  it("should re-render after removing an item", () => {
    app.rerender([initialItems()[0]!]);

    const html = renderer.renderToString();
    expect(html).toContain("Buy milk");
    expect(html).not.toContain("Walk dog");
  });
});

// ---------------------------------------------------------------------------
// JSON Renderer
// ---------------------------------------------------------------------------

describe("JsonRender", () => {
  let renderer: JsonRender;
  let app: ReturnType<typeof createTodoApp>;

  beforeEach(() => {
    renderer = new JsonRender();
    app = createTodoApp(renderer);
  });

  function findNodes(node: JsonNode, type: string): JsonNode[] {
    const results: JsonNode[] = [];
    if (node.type === type) results.push(node);
    for (const child of node.children) {
      results.push(...findNodes(child, type));
    }
    return results;
  }

  it("should render initial todo app", () => {
    const json = renderer.root!;
    expect(json).toBeDefined();

    const divs = findNodes(json, "div");
    expect(divs.length).toBeGreaterThan(0);

    const texts = findNodes(json, "text");
    const contents = texts.map((t) => t.props.content);
    expect(contents).toContain("Buy milk");
    expect(contents).toContain("Walk dog");
  });

  it("should have correct tree structure", () => {
    const json = renderer.root!;

    // Root is composite, find the app div inside
    const appDivs = findNodes(json, "div").filter(
      (d) => d.props.class === "app",
    );
    expect(appDivs.length).toBe(1);
    const appDiv = appDivs[0]!;

    // App div has 2 composite children (TodoItems)
    const composites = appDiv.children.filter((c) => c.type === "composite");
    expect(composites.length).toBe(2);

    expect(composites[0]!.key).toBe("1");
    expect(composites[1]!.key).toBe("2");
  });

  it("should update props via apply after re-render", () => {
    app.rerender([
      { id: "1", text: "Buy cheese", done: true },
      { id: "2", text: "Walk dog", done: true },
    ]);

    const json = renderer.root!;
    const texts = findNodes(json, "text");
    const contents = texts.map((t) => t.props.content);
    expect(contents).toContain("Buy cheese");
    expect(contents).not.toContain("Buy milk");
  });

  it("should handle adding items", () => {
    app.rerender([
      ...initialItems(),
      { id: "3", text: "Read book", done: false },
    ]);

    const json = renderer.root!;
    const texts = findNodes(json, "text");
    expect(texts.length).toBe(3);
    const contents = texts.map((t) => t.props.content);
    expect(contents).toContain("Read book");
  });

  it("should handle removing items", () => {
    app.rerender([initialItems()[0]!]);

    const json = renderer.root!;
    const texts = findNodes(json, "text");
    expect(texts.length).toBe(1);
    expect(texts[0]!.props.content).toBe("Buy milk");
  });
});

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

describe("HtmlRender", () => {
  let container: HTMLElement;
  let app: ReturnType<typeof createTodoApp>;

  beforeEach(() => {
    container = document.createElement("div");
    const renderer = new HtmlRender(container);
    app = createTodoApp(renderer);
  });

  it("should render initial todo app to DOM", () => {
    expect(container.textContent).toContain("Buy milk");
    expect(container.textContent).toContain("Walk dog");

    const appDiv = findByClass(container, "app")[0];
    expect(appDiv).toBeDefined();
    expect(appDiv!.tagName).toBe("DIV");
  });

  it("should render correct HTML structure", () => {
    const buttons = container.getElementsByTagName("button");
    expect(buttons.length).toBe(2);

    const spans = container.getElementsByTagName("span");
    expect(spans.length).toBe(2);

    expect(spans[0]!.className).toBe("text");
    expect(spans[1]!.className).toBe("text");
  });

  it("should apply correct CSS classes", () => {
    const todoDivs = findByClass(container, "todo");
    const doneDivs = findByClass(container, "done");

    expect(todoDivs.length).toBe(2);
    expect(doneDivs.length).toBe(1);
  });

  it("should apply HTML attributes", () => {
    const deleteButtons = findByClass(container, "delete");
    expect(deleteButtons.length).toBe(2);

    const textSpans = findByClass(container, "text");
    expect(textSpans.length).toBe(2);
  });

  it("should update text content on re-render", () => {
    app.rerender([
      { id: "1", text: "Buy cheese", done: false },
      { id: "2", text: "Walk dog", done: true },
    ]);

    expect(container.textContent).toContain("Buy cheese");
    expect(container.textContent).not.toContain("Buy milk");
    expect(container.textContent).toContain("Walk dog");
  });

  it("should update class on toggle done", () => {
    app.rerender([
      { id: "1", text: "Buy milk", done: true },
      { id: "2", text: "Walk dog", done: false },
    ]);

    const doneDivs = findByClass(container, "done");
    expect(doneDivs.length).toBe(1);
    expect(doneDivs[0]!.textContent).toContain("Buy milk");
  });

  it("should add a new item to the DOM", () => {
    app.rerender([
      ...initialItems(),
      { id: "3", text: "Read book", done: false },
    ]);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(3);
    expect(container.textContent).toContain("Read book");
  });

  it("should remove an item from the DOM", () => {
    app.rerender([initialItems()[0]!]);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(1);
    expect(container.textContent).toContain("Buy milk");
    expect(container.textContent).not.toContain("Walk dog");
  });

  it("should handle replacing all items", () => {
    app.rerender([
      { id: "10", text: "New item A", done: false },
      { id: "20", text: "New item B", done: true },
    ]);

    expect(container.textContent).not.toContain("Buy milk");
    expect(container.textContent).not.toContain("Walk dog");
    expect(container.textContent).toContain("New item A");
    expect(container.textContent).toContain("New item B");
  });

  it("should handle empty list", () => {
    app.rerender([]);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(0);

    const appDiv = findByClass(container, "app")[0];
    expect(appDiv).toBeDefined();
  });

  it("should fire click events via onClick prop", () => {
    let clicked = false;

    const ClickApp = view<void>(() => ({
      render() {
        button({
          class: "click-me",
          onClick: () => {
            clicked = true;
          },
        });
      },
    }));

    const c = document.createElement("div");
    const r = new HtmlRender(c);
    const e = new Engine(r);
    orchestrator.setCurrentEngine(e);
    e.createRoot(() => { ClickApp(); }, {});
    e.render();

    const btn = c.getElementsByTagName("button")[0]!;
    expect(btn).toBeDefined();
    btn.click();
    expect(clicked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// String slots
// ---------------------------------------------------------------------------

describe("String slots", () => {
  function mountStateful(viewFn: (props?: any, slot?: any) => void) {
    const container = document.createElement("div");
    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    engine.createRoot(() => { viewFn(); }, {});
    engine.render();
    return { container, engine };
  }

  it("should render a string slot on a primitive", () => {
    const App = view<void>(() => ({
      render() {
        span({ class: "label" }, "hello");
      },
    }));

    const { container } = mountStateful(App);
    expect(container.textContent).toBe("hello");
  });

  it("should render a string slot on a composite view", () => {
    const Card = view<{ title: string }>(({ props, slot }) => ({
      render() {
        div({ class: "card" }, () => {
          div({ class: "title" }, () => { text(props().title); });
          div({ class: "body" }, slot);
        });
      },
    }));

    const App = view<void>(() => ({
      render() {
        Card({ title: "Header" }, "body content");
      },
    }));

    const { container } = mountStateful(App);
    expect(container.textContent).toContain("Header");
    expect(container.textContent).toContain("body content");
  });

  it("should update string slot on re-render", () => {
    let labelState: Reactive<string>;

    const App = view<void>(({ use }) => {
      const label = use("initial");
      labelState = label;
      return {
        render() {
          span({ class: "label" }, label.get());
        },
      };
    });

    const { container, engine } = mountStateful(App);
    expect(container.textContent).toBe("initial");

    labelState!.set("updated");
    engine.render();
    expect(container.textContent).toBe("updated");
  });

  it("should produce same output as function slot with text()", () => {
    const AppString = view<void>(() => ({
      render() {
        div({ class: "a" }, "hello");
        span({ class: "b" }, "world");
      },
    }));

    const AppFunc = view<void>(() => ({
      render() {
        div({ class: "a" }, () => { text("hello"); });
        span({ class: "b" }, () => { text("world"); });
      },
    }));

    const c1 = document.createElement("div");
    const r1 = new HtmlRender(c1);
    const e1 = new Engine(r1);
    orchestrator.setCurrentEngine(e1);
    e1.createRoot(() => { AppString(); }, {});
    e1.render();

    const c2 = document.createElement("div");
    const r2 = new HtmlRender(c2);
    const e2 = new Engine(r2);
    orchestrator.setCurrentEngine(e2);
    e2.createRoot(() => { AppFunc(); }, {});
    e2.render();

    expect(c1.innerHTML).toBe(c2.innerHTML);
  });
});

// ---------------------------------------------------------------------------
// State-driven rendering
// ---------------------------------------------------------------------------

describe("State", () => {
  function mountStateful(viewFn: (props?: any, slot?: any) => void) {
    const container = document.createElement("div");
    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    engine.createRoot(() => { viewFn(); }, {});
    engine.render();
    return { container, engine };
  }

  it("should render initial state", () => {
    const Counter = view<void>(({ use }) => {
      const count = use(0);
      return {
        render() {
          div({ class: "counter" }, () => {
            text(count.get());
          });
        },
      };
    });

    const { container } = mountStateful(Counter);
    expect(container.textContent).toBe("0");
  });

  it("should update DOM after state.set + renderCycle", () => {
    let countState: Reactive<number>;

    const Counter = view<void>(({ use }) => {
      const count = use(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    });

    const { engine, container } = mountStateful(Counter);
    expect(container.textContent).toBe("0");

    countState!.set(42);
    engine.render();
    expect(container.textContent).toBe("42");
  });

  it("should apply state immediately on set", () => {
    let countState: Reactive<number>;

    const Counter = view<void>(({ use }) => {
      const count = use(10);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    });

    mountStateful(Counter);

    countState!.set(99);
    expect(countState!.get()).toBe(99);
  });

  it("should batch multiple sets into one render", () => {
    let countState: Reactive<number>;
    let renderCount = 0;

    const Counter = view<void>(({ use }) => {
      const count = use(0);
      countState = count;
      return {
        render() {
          renderCount++;
          text(count.get());
        },
      };
    });

    const { engine } = mountStateful(Counter);
    renderCount = 0;

    countState!.set(1);
    countState!.set(2);
    countState!.set(3);
    engine.render();

    expect(countState!.get()).toBe(3);
    expect(renderCount).toBe(1);
  });

  it("should chain updates through pending", () => {
    let countState: Reactive<number>;

    const Counter = view<void>(({ use }) => {
      const count = use(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    });

    const { engine, container } = mountStateful(Counter);

    countState!.update((n) => n + 1);
    countState!.update((n) => n + 1);
    countState!.update((n) => n + 1);
    engine.render();

    expect(container.textContent).toBe("3");
  });

  it("should re-render a list managed by state", () => {
    let itemsState: Reactive<string[]>;

    const Item = view<{ label: string }>((ctx) => ({
      render() {
        div({ class: "item" }, () => {
          text(ctx.props().label);
        });
      },
    }));

    const ListApp = view<void>(({ use }) => {
      const items = use<string[]>(["one", "two"]);
      itemsState = items;
      return {
        render() {
          div({ class: "list" }, () => {
            for (const item of items.get()) {
              Item({ label: item, key: item });
            }
          });
        },
      };
    });

    const { engine, container } = mountStateful(ListApp);
    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).toContain("one");
    expect(container.textContent).toContain("two");

    itemsState!.update((items) => [...items, "three"]);
    engine.render();
    expect(findByClass(container, "item").length).toBe(3);
    expect(container.textContent).toContain("three");

    itemsState!.update((items) => items.filter((i) => i !== "two"));
    engine.render();
    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).not.toContain("two");
  });

  it("should handle state-driven conditional rendering", () => {
    let editingState: Reactive<boolean>;

    const CondApp = view<void>(({ use }) => {
      const editing = use(false);
      editingState = editing;
      return {
        render() {
          if (editing.get()) {
            input({ class: "editor", value: "hello" });
          } else {
            div(
              { class: "display", onClick: () => editing.set(true) },
              "click to edit",
            );
          }
        },
      };
    });

    const { engine, container } = mountStateful(CondApp);
    expect(findByClass(container, "display").length).toBe(1);
    expect(container.getElementsByTagName("input").length).toBe(0);

    editingState!.set(true);
    engine.render();
    expect(findByClass(container, "display").length).toBe(0);
    expect(container.getElementsByTagName("input").length).toBe(1);

    editingState!.set(false);
    engine.render();
    expect(findByClass(container, "display").length).toBe(1);
    expect(container.getElementsByTagName("input").length).toBe(0);
  });

  it("should not re-insert a disposed branch on unrelated parent re-render", () => {
    const auth = store.new<{ user: number | null }>({ user: null });
    const route = store.new("/");
    const submitting = store.new(false);

    const Login = view<void>(({ use }) => {
      const s = use(submitting);
      return {
        render() {
          div({ class: "login" }, s.get() ? "submitting" : "idle");
        },
      };
    });
    const Hub = view<void>(() => ({
      render() { div({ class: "hub" }, "hub"); },
    }));

    const App = view<void>(({ use }) => {
      const a = use(auth);
      const r = use(route);
      return {
        render() {
          div({ id: "router" }, () => {
            void r.get();
            if (!a.get().user) Login();
            else Hub();
          });
        },
      };
    });

    const { engine, container } = mountStateful(App);
    expect(findByClass(container, "login").length).toBe(1);

    // Simulate submit: mark submitting, switch auth, clear submitting — all in one batch.
    submitting.set(true);
    auth.set({ user: 1 });
    submitting.set(false);
    engine.render();
    expect(findByClass(container, "login").length).toBe(0);
    expect(findByClass(container, "hub").length).toBe(1);

    route.set("/");
    engine.render();
    expect(findByClass(container, "login").length).toBe(0);
    expect(findByClass(container, "hub").length).toBe(1);
  });

  it("should create SVG elements in the SVG namespace", () => {
    const path = html("path");
    const circle = html("circle");

    const App = view<void>(() => ({
      render() {
        div({ class: "wrap" }, () => {
          svg({ viewBox: "0 0 24 24", width: 24, height: 24 }, () => {
            path({ d: "M1 1 L10 10" });
            circle({ cx: 5, cy: 5, r: 3 });
          });
        });
      },
    }));

    const { container } = mountStateful(App);
    const SVG_NS = "http://www.w3.org/2000/svg";
    const wrap = findByClass(container, "wrap")[0]!;
    const svgEl = wrap.children[0]!;
    expect(svgEl.namespaceURI).toBe(SVG_NS);
    expect(svgEl.tagName.toLowerCase()).toBe("svg");
    expect(svgEl.getAttribute("viewBox")).toBe("0 0 24 24");

    expect(svgEl.children.length).toBe(2);
    const pathEl = svgEl.children[0]!;
    const circleEl = svgEl.children[1]!;
    expect(pathEl.namespaceURI).toBe(SVG_NS);
    expect(pathEl.tagName.toLowerCase()).toBe("path");
    expect(pathEl.getAttribute("d")).toBe("M1 1 L10 10");
    expect(circleEl.namespaceURI).toBe(SVG_NS);
    expect(circleEl.getAttribute("r")).toBe("3");

    // The surrounding div stays in HTML namespace.
    expect(wrap.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
  });

  it("should not remove parent DOM when disposing an F_TEXT_CONTENT text child", () => {
    const phase = store.new<"loading" | "loaded">("loading");

    const Panel = view<void>(({ use }) => {
      const p = use(phase);
      return {
        render() {
          // Same-viewFn at pos 0 both phases: div({class:"slot"}, ...).
          // Phase A: single text child -> F_TEXT_CONTENT optimization engages.
          // Phase B: replaces text child with a nested div -> dispose(text)
          // would remove the parent <div class="slot"> via ref.element without
          // the F_TEXT_CONTENT guard in removeDomNodes.
          div({ class: "page" }, () => {
            if (p.get() === "loading") {
              div({ class: "slot" }, () => { text("Loading"); });
            } else {
              div({ class: "slot" }, () => {
                div({ class: "inner" }, () => { text("HERO"); });
              });
            }
            div({ class: "after" }, () => { text("AFTER"); });
          });
        },
      };
    });

    const { engine, container } = mountStateful(Panel);
    const page = findByClass(container, "page")[0]!;
    expect(page.children.length).toBe(2);
    expect((page.children[0] as HTMLElement).className).toBe("slot");
    expect((page.children[1] as HTMLElement).className).toBe("after");

    phase.set("loaded");
    engine.render();

    expect(page.children.length).toBe(2);
    const slot = page.children[0] as HTMLElement;
    const after = page.children[1] as HTMLElement;
    expect(slot.className).toBe("slot");
    expect(after.className).toBe("after");
    // The new inner div must land inside .slot, not into a detached node.
    expect(slot.children.length).toBe(1);
    expect((slot.children[0] as HTMLElement).className).toBe("inner");
    expect((slot.children[0] as HTMLElement).textContent).toBe("HERO");
  });

  it("growing children inside a view mounted by a parent switch, with onMount-driven state", async () => {
    const authed = store.new(false);

    const Hub = view<void>(({ use }) => {
      const loading = use(true);
      const items = use<string[]>([]);
      return {
        onMount() {
          queueMicrotask(() => {
            items.set(["a", "b", "c"]);
            loading.set(false);
          });
        },
        render() {
          div({ class: "page" }, () => {
            div({ class: "header" }, () => { text("HEADER"); });
            if (loading.get()) {
              div({ class: "spinner" }, () => { text("Loading"); });
              return;
            }
            div({ class: "hero" }, () => { text("HERO"); });
            div({ class: "eyebrow" }, () => { text("EYEBROW"); });
            for (const it of items.get()) {
              div({ class: "item" }, () => { text(it); });
            }
          });
        },
      };
    });

    const Login = view<void>(() => ({
      render() { div({ class: "login" }, () => { text("LOGIN"); }); },
    }));

    const App = view<void>(({ use }) => {
      const a = use(authed);
      return {
        render() {
          div({ id: "router" }, () => {
            if (!a.get()) Login();
            else Hub();
          });
        },
      };
    });

    const { engine, container } = mountStateful(App);
    expect(findByClass(container, "login").length).toBe(1);
    expect(findByClass(container, "page").length).toBe(0);

    authed.set(true);
    engine.render();
    const page1 = findByClass(container, "page")[0]!;
    expect(page1.children.length).toBe(2);

    await Promise.resolve();
    engine.render();

    const page = findByClass(container, "page")[0]!;
    expect(page.children.length).toBe(6);
    expect((page.children[0] as HTMLElement).className).toBe("header");
    expect((page.children[1] as HTMLElement).className).toBe("hero");
    expect((page.children[2] as HTMLElement).className).toBe("eyebrow");
    expect((page.children[3] as HTMLElement).className).toBe("item");
    expect((page.children[4] as HTMLElement).className).toBe("item");
    expect((page.children[5] as HTMLElement).className).toBe("item");
  });

  it("should grow non-keyed child list with in-place patch at middle index", () => {
    const phase = store.new<"loading" | "loaded">("loading");

    const App = view<void>(({ use }) => {
      const p = use(phase);
      return {
        render() {
          div({ class: "page" }, () => {
            div({ class: "header" }, () => { text("HEADER"); });
            if (p.get() === "loading") {
              div({ class: "spinner" }, () => { text("Loading"); });
              return;
            }
            div({ class: "hero" }, () => { text("HERO"); });
            div({ class: "eyebrow" }, () => { text("EYEBROW"); });
            div({ class: "empty" }, () => { text("EMPTY"); });
          });
        },
      };
    });

    const { engine, container } = mountStateful(App);
    const page = findByClass(container, "page")[0]!;
    expect(page.children.length).toBe(2);
    expect((page.children[0] as HTMLElement).className).toBe("header");
    expect((page.children[1] as HTMLElement).className).toBe("spinner");

    phase.set("loaded");
    engine.render();

    expect(page.children.length).toBe(4);
    const c0 = page.children[0] as HTMLElement;
    const c1 = page.children[1] as HTMLElement;
    const c2 = page.children[2] as HTMLElement;
    const c3 = page.children[3] as HTMLElement;
    expect(c0.className).toBe("header");
    expect(c1.className).toBe("hero");
    expect(c1.textContent).toBe("HERO");
    expect(c2.className).toBe("eyebrow");
    expect(c2.textContent).toBe("EYEBROW");
    expect(c3.className).toBe("empty");
    expect(c3.textContent).toBe("EMPTY");
  });

  it("should work with JSON renderer", () => {
    let countState: Reactive<number>;

    const Counter = view<void>(({ use }) => {
      const count = use(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    });

    const renderer = new JsonRender();
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    engine.createRoot(() => { Counter(); }, {});
    engine.render();

    const texts = findJsonNodes(renderer.root!, "text");
    expect(texts[0]!.props.content).toBe(0);

    countState!.set(7);
    engine.render();
    const texts2 = findJsonNodes(renderer.root!, "text");
    expect(texts2[0]!.props.content).toBe(7);
  });

  it("should work with String renderer", () => {
    let countState: Reactive<number>;

    const Counter = view<void>(({ use }) => {
      const count = use(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    });

    const renderer = new HtmlStringRender();
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    engine.createRoot(() => { Counter(); }, {});
    engine.render();

    expect(renderer.renderToString()).toBe("0");

    countState!.set(99);
    engine.render();
    expect(renderer.renderToString()).toBe("99");
  });

  it("should render children through composite view slot", () => {
    const Card = view<{ title: string }>(({ props, slot }) => ({
      render() {
        div({ class: "card" }, () => {
          div({ class: "card-title" }, () => {
            text(props().title);
          });
          div({ class: "card-body" }, slot);
        });
      },
    }));

    const SlotApp = view<void>(() => ({
      render() {
        Card({ title: "Hello" }, () => {
          span({ class: "child" }, "child content");
        });
      },
    }));

    const { container } = mountStateful(SlotApp);

    expect(findByClass(container, "card").length).toBe(1);
    expect(findByClass(container, "card-title").length).toBe(1);
    expect(findByClass(container, "card-body").length).toBe(1);
    expect(findByClass(container, "child").length).toBe(1);
    expect(container.textContent).toContain("Hello");
    expect(container.textContent).toContain("child content");
  });

  it("should propagate child prop changes through composite slot", () => {
    let activeState: Reactive<string | null>;

    const Wrapper = view<{ label: string }>(({ props, slot }) => ({
      render() {
        div({ class: "wrapper" }, () => {
          text(props().label);
          div({ class: "body" }, slot);
        });
      },
    }));

    const Item = view<{ id: string; highlight: boolean }>(({ props }) => ({
      render() {
        div({ class: props().highlight ? "item active" : "item" }, () => {
          text(props().id);
        });
      },
    }));

    const PropApp = view<void>(({ use }) => {
      const active = use<string | null>(null);
      activeState = active;
      return {
        render() {
          const a = active.get();
          Wrapper({ label: "list" }, () => {
            for (const id of ["X", "Y", "Z"]) {
              Item({ key: id, id, highlight: a === id });
            }
          });
        },
      };
    });

    const { container, engine } = mountStateful(PropApp);
    expect(findByClass(container, "active").length).toBe(0);
    expect(findByClass(container, "item").length).toBe(3);

    activeState!.set("Y");
    engine.render();
    expect(findByClass(container, "active").length).toBe(1);
    expect(findByClass(container, "active")[0]!.textContent).toBe("Y");

    activeState!.set("Z");
    engine.render();
    expect(findByClass(container, "active").length).toBe(1);
    expect(findByClass(container, "active")[0]!.textContent).toBe("Z");

    activeState!.set(null);
    engine.render();
    expect(findByClass(container, "active").length).toBe(0);
  });

  it("should update children through composite view slot on re-render", () => {
    let itemsState: Reactive<string[]>;

    const Card = view<{ title: string }>(({ props, slot }) => ({
      render() {
        div({ class: "card" }, () => {
          div({ class: "card-title" }, () => {
            text(props().title);
          });
          div({ class: "card-body" }, slot);
        });
      },
    }));

    const CardApp = view<void>(({ use }) => {
      const items = use<string[]>(["one", "two"]);
      itemsState = items;
      return {
        render() {
          Card({ title: "List" }, () => {
            for (const item of items.get()) {
              div({ class: "item", key: item }, () => {
                text(item);
              });
            }
          });
        },
      };
    });

    const { container, engine } = mountStateful(CardApp);

    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).toContain("one");
    expect(container.textContent).toContain("two");

    itemsState!.update((items) => [...items, "three"]);
    engine.render();

    expect(findByClass(container, "item").length).toBe(3);
    expect(container.textContent).toContain("three");

    itemsState!.set(["only"]);
    engine.render();

    expect(findByClass(container, "item").length).toBe(1);
    expect(container.textContent).toContain("only");
    expect(container.textContent).not.toContain("one");
  });

  it("should preserve DOM order when switching viewFn on keyed children", () => {
    let editingState: Reactive<string | null>;

    const Display = view<{ label: string }>(({ props }) => ({
      render() {
        div({ class: "display" }, () => {
          text(props().label);
        });
      },
    }));

    const Editor = view<{ label: string }>(({ props }) => ({
      render() {
        input({ class: "editor", value: props().label });
      },
    }));

    const SwitchApp = view<void>(({ use }) => {
      const editing = use<string | null>(null);
      editingState = editing;
      return {
        render() {
          div({ class: "list" }, () => {
            for (const id of ["A", "B", "C"]) {
              if (editing.get() === id) {
                Editor({ key: id, label: id });
              } else {
                Display({ key: id, label: id });
              }
            }
          });
        },
      };
    });

    const { container, engine } = mountStateful(SwitchApp);
    const list = findByClass(container, "list")[0]!;

    expect(list.textContent).toBe("ABC");

    editingState!.set("B");
    engine.render();
    const displays = findByClass(list, "display");
    const editors = list.getElementsByTagName("input");
    expect(displays.length).toBe(2);
    expect(editors.length).toBe(1);
    expect(displays[0]!.textContent).toBe("A");
    expect(displays[1]!.textContent).toBe("C");
    expect(
      displays[0]!.compareDocumentPosition(editors[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      editors[0]!.compareDocumentPosition(displays[1]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    editingState!.set(null);
    engine.render();
    expect(list.textContent).toBe("ABC");

    editingState!.set("A");
    engine.render();
    {
      const d = findByClass(list, "display");
      expect(d.length).toBe(2);
      expect(d[0]!.textContent).toBe("B");
      expect(d[1]!.textContent).toBe("C");
    }

    editingState!.set("C");
    engine.render();
    {
      const d = findByClass(list, "display");
      expect(d.length).toBe(2);
      expect(d[0]!.textContent).toBe("A");
      expect(d[1]!.textContent).toBe("B");
      const e = list.getElementsByTagName("input");
      expect(e.length).toBe(1);
    }
    const aDiv = findByClass(list, "display")[0]!;
    const bDiv = findByClass(list, "display")[1]!;
    expect(
      aDiv.compareDocumentPosition(bDiv) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should preserve DOM order after reorder then viewFn switch", () => {
    let listState: Reactive<string[]>;
    let editingState: Reactive<string | null>;

    const Display = view<{ label: string }>(({ props }) => ({
      render() {
        div({ class: "display" }, () => {
          text(props().label);
        });
      },
    }));
    const Editor = view<{ label: string }>(({ props }) => ({
      render() {
        input({ class: "editor", value: props().label });
      },
    }));

    const ReorderApp = view<void>(({ use }) => {
      const items = use(["A", "B", "C"]);
      const editing = use<string | null>(null);
      listState = items;
      editingState = editing;
      return {
        render() {
          div({ class: "list" }, () => {
            for (const id of items.get()) {
              if (editing.get() === id) {
                Editor({ key: id, label: id });
              } else {
                Display({ key: id, label: id });
              }
            }
          });
        },
      };
    });

    const { container, engine } = mountStateful(ReorderApp);
    const list = findByClass(container, "list")[0]!;
    expect(list.textContent).toBe("ABC");

    listState!.set(["B", "C", "A"]);
    engine.render();
    expect(list.textContent).toBe("BCA");

    editingState!.set("B");
    engine.render();
    {
      const d = findByClass(list, "display");
      expect(d.length).toBe(2);
      expect(d[0]!.textContent).toBe("C");
      expect(d[1]!.textContent).toBe("A");
      const e = list.getElementsByTagName("input");
      expect(e.length).toBe(1);
      expect(
        e[0]!.compareDocumentPosition(d[0]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    editingState!.set(null);
    engine.render();
    expect(list.textContent).toBe("BCA");
  });

  it("should reorder DOM when keyed children swap positions", () => {
    type RowData = { id: number; label: string };
    let listState: Reactive<RowData[]>;

    const Row = view<{ item: RowData }>((ctx) => ({
      shouldUpdate(next: { item: RowData }) {
        return next.item.label !== ctx.props().item.label;
      },
      render() {
        div({ class: "row" }, () => {
          text(ctx.props().item.label);
        });
      },
    }));

    const SwapApp = view<void>(({ use }) => {
      const items = use<RowData[]>([
        { id: 1, label: "A" },
        { id: 2, label: "B" },
        { id: 3, label: "C" },
        { id: 4, label: "D" },
        { id: 5, label: "E" },
      ]);
      listState = items;
      return {
        render() {
          div({ class: "list" }, () => {
            for (const item of items.get()) {
              Row({ key: item.id, item });
            }
          });
        },
      };
    });

    const { container, engine } = mountStateful(SwapApp);
    expect(container.textContent).toBe("ABCDE");

    const data = listState!.get();
    const next = [...data];
    const tmp = next[1]!;
    next[1] = next[3]!;
    next[3] = tmp;
    listState!.set(next);
    engine.render();

    expect(container.textContent).toBe("ADCBE");
  });
});

// ---------------------------------------------------------------------------
// Helper for JSON tests
// ---------------------------------------------------------------------------

function findJsonNodes(node: JsonNode, type: string): JsonNode[] {
  const results: JsonNode[] = [];
  if (node.type === type) results.push(node);
  for (const child of node.children) {
    results.push(...findJsonNodes(child, type));
  }
  return results;
}
