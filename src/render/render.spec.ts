import { describe, it, expect, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import type { ViewFn } from "@/public/view";
import { view } from "@/public/view";
import { div, span, text, button, input } from "@/public/primitives/primitives";
import type { State } from "@/public/state";
import { Engine } from "@/internal/engine";
import { View } from "@/internal/internal_view";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "./html_render";
import { JsonRender, type JsonNode } from "./json_render";
import { StringRender } from "./string_render";
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

const TodoItemCall = view<TodoItem>(({ props }) => ({
  render() {
    div({ class: props.done ? "todo done" : "todo" }, () => {
      span({ class: "text" }, () => {
        text(props.text);
      });
      button({ class: "delete" });
    });
  },
}));

const todoAppViewFn: ViewFn<Wildcard, Wildcard> = ({ props }) => ({
  render() {
    div({ class: "app" }, () => {
      (props.items as TodoItem[]).forEach((item: TodoItem) => {
        TodoItemCall({ ...item, key: item.id }, () => {});
      });
    });
  },
});

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

function createApp(renderer: IRender<Wildcard>) {
  const engine = new Engine(renderer);
  orchestrator.setCurrentEngine(engine);
  const items = initialItems();
  const rootView = new View(
    todoAppViewFn,
    engine,
    { items },
    () => {},
    null,
    null,
  );
  engine.initialRender();
  return { engine, rootView, items };
}

function rerender(engine: Engine, rootView: View, newItems: TodoItem[]) {
  rootView.props = { items: newItems };
  engine.markNeedRender(rootView);
  engine.renderCycle();
}

// ---------------------------------------------------------------------------
// String Renderer
// ---------------------------------------------------------------------------

describe("StringRender", () => {
  let renderer: StringRender;
  let engine: Engine;
  let rootView: View;

  beforeEach(() => {
    renderer = new StringRender();
    ({ engine, rootView } = createApp(renderer));
  });

  it("should render initial todo app", () => {
    const html = renderer.renderToString();
    expect(html).toContain("Buy milk");
    expect(html).toContain("Walk dog");
    expect(html).toContain("<div>");
    expect(html).toContain("<span>");
    expect(html).toContain("<button>");
  });

  it("should re-render with updated items", () => {
    rerender(engine, rootView, [
      { id: "1", text: "Buy cheese", done: false },
      { id: "2", text: "Walk dog", done: true },
    ]);

    const html = renderer.renderToString();
    expect(html).toContain("Buy cheese");
    expect(html).not.toContain("Buy milk");
    expect(html).toContain("Walk dog");
  });

  it("should re-render after adding an item", () => {
    rerender(engine, rootView, [
      ...initialItems(),
      { id: "3", text: "Read book", done: false },
    ]);

    const html = renderer.renderToString();
    expect(html).toContain("Buy milk");
    expect(html).toContain("Walk dog");
    expect(html).toContain("Read book");
  });

  it("should re-render after removing an item", () => {
    rerender(engine, rootView, [initialItems()[0]!]);

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
  let engine: Engine;
  let rootView: View;

  beforeEach(() => {
    renderer = new JsonRender();
    ({ engine, rootView } = createApp(renderer));
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

    expect(json.type).toBe("composite");

    const divs = findNodes(json, "div");
    expect(divs.length).toBeGreaterThan(0);
    expect(divs[0]!.props.class).toBe("app");

    const texts = findNodes(json, "text");
    const contents = texts.map((t) => t.props.content);
    expect(contents).toContain("Buy milk");
    expect(contents).toContain("Walk dog");
  });

  it("should have correct tree structure", () => {
    const json = renderer.root!;

    const appDiv = json.children[0]!;
    expect(appDiv.type).toBe("div");
    expect(appDiv.props.class).toBe("app");

    expect(appDiv.children.length).toBe(2);

    const item1 = appDiv.children[0]!;
    expect(item1.type).toBe("composite");
    expect(item1.key).toBe("1");

    const item1Div = item1.children[0]!;
    expect(item1Div.type).toBe("div");
    expect(item1Div.props.class).toBe("todo");

    const item2 = appDiv.children[1]!;
    expect(item2.type).toBe("composite");
    const item2Div = item2.children[0]!;
    expect(item2Div.props.class).toBe("todo done");
  });

  it("should update props via apply after re-render", () => {
    rerender(engine, rootView, [
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
    rerender(engine, rootView, [
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
    rerender(engine, rootView, [initialItems()[0]!]);

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
  let renderer: HtmlRender;
  let engine: Engine;
  let rootView: View;

  beforeEach(() => {
    container = document.createElement("div");
    renderer = new HtmlRender(container);
    ({ engine, rootView } = createApp(renderer));
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
    rerender(engine, rootView, [
      { id: "1", text: "Buy cheese", done: false },
      { id: "2", text: "Walk dog", done: true },
    ]);

    expect(container.textContent).toContain("Buy cheese");
    expect(container.textContent).not.toContain("Buy milk");
    expect(container.textContent).toContain("Walk dog");
  });

  it("should update class on toggle done", () => {
    rerender(engine, rootView, [
      { id: "1", text: "Buy milk", done: true },
      { id: "2", text: "Walk dog", done: false },
    ]);

    const doneDivs = findByClass(container, "done");
    expect(doneDivs.length).toBe(1);
    expect(doneDivs[0]!.textContent).toContain("Buy milk");
  });

  it("should add a new item to the DOM", () => {
    rerender(engine, rootView, [
      ...initialItems(),
      { id: "3", text: "Read book", done: false },
    ]);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(3);
    expect(container.textContent).toContain("Read book");
  });

  it("should remove an item from the DOM", () => {
    rerender(engine, rootView, [initialItems()[0]!]);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(1);
    expect(container.textContent).toContain("Buy milk");
    expect(container.textContent).not.toContain("Walk dog");
  });

  it("should handle replacing all items", () => {
    rerender(engine, rootView, [
      { id: "10", text: "New item A", done: false },
      { id: "20", text: "New item B", done: true },
    ]);

    expect(container.textContent).not.toContain("Buy milk");
    expect(container.textContent).not.toContain("Walk dog");
    expect(container.textContent).toContain("New item A");
    expect(container.textContent).toContain("New item B");
  });

  it("should handle empty list", () => {
    rerender(engine, rootView, []);

    const todoDivs = findByClass(container, "todo");
    expect(todoDivs.length).toBe(0);

    const appDiv = findByClass(container, "app")[0];
    expect(appDiv).toBeDefined();
  });

  it("should fire click events via onClick prop", () => {
    let clicked = false;

    const clickViewFn: ViewFn<Wildcard, Wildcard> = () => ({
      render() {
        button({ class: "click-me", onClick: () => { clicked = true; } });
      },
    });

    const c = document.createElement("div");
    const r = new HtmlRender(c);
    const e = new Engine(r);
    orchestrator.setCurrentEngine(e);
    new View(clickViewFn, e, {}, () => {}, null, null);
    e.initialRender();

    const btn = c.getElementsByTagName("button")[0]!;
    expect(btn).toBeDefined();
    btn.click();
    expect(clicked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// State-driven rendering
// ---------------------------------------------------------------------------

describe("State", () => {
  function mountStateful(viewFn: ViewFn<Wildcard, Wildcard>) {
    const container = document.createElement("div");
    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    new View(viewFn, engine, {}, () => {}, null, null);
    engine.initialRender();
    return { container, engine };
  }

  it("should render initial state", () => {
    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      return {
        render() {
          div({ class: "counter" }, () => {
            text(count.get());
          });
        },
      };
    };

    const { container } = mountStateful(viewFn);
    expect(container.textContent).toBe("0");
  });

  it("should update DOM after state.set + renderCycle", () => {
    let countState: State<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    const { engine, container } = mountStateful(viewFn);
    expect(container.textContent).toBe("0");

    countState!.set(42);
    engine.renderCycle();
    expect(container.textContent).toBe("42");
  });

  it("should not apply state immediately (deferred until render)", () => {
    let countState: State<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(10);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    mountStateful(viewFn);

    countState!.set(99);
    // Before renderCycle, get() still returns old value
    expect(countState!.get()).toBe(10);
  });

  it("should batch multiple sets into one render", () => {
    let countState: State<number>;
    let renderCount = 0;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      countState = count;
      return {
        render() {
          renderCount++;
          text(count.get());
        },
      };
    };

    const { engine } = mountStateful(viewFn);
    renderCount = 0;

    countState!.set(1);
    countState!.set(2);
    countState!.set(3);
    engine.renderCycle();

    expect(countState!.get()).toBe(3);
    expect(renderCount).toBe(1);
  });

  it("should chain updates through pending", () => {
    let countState: State<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    const { engine, container } = mountStateful(viewFn);

    countState!.update((n) => n + 1);
    countState!.update((n) => n + 1);
    countState!.update((n) => n + 1);
    engine.renderCycle();

    expect(container.textContent).toBe("3");
  });

  it("should re-render a list managed by state", () => {
    let itemsState: State<string[]>;

    const Item = view<{ label: string }>(({ props }) => ({
      render() {
        div({ class: "item" }, () => {
          text(props.label);
        });
      },
    }));

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const items = state<string[]>(["one", "two"]);
      itemsState = items;
      return {
        render() {
          div({ class: "list" }, () => {
            for (const item of items.get()) {
              Item({ label: item, key: item }, () => {});
            }
          });
        },
      };
    };

    const { engine, container } = mountStateful(viewFn);
    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).toContain("one");
    expect(container.textContent).toContain("two");

    // Add item
    itemsState!.update((items) => [...items, "three"]);
    engine.renderCycle();
    expect(findByClass(container, "item").length).toBe(3);
    expect(container.textContent).toContain("three");

    // Remove item
    itemsState!.update((items) => items.filter((i) => i !== "two"));
    engine.renderCycle();
    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).not.toContain("two");
  });

  it("should handle state-driven conditional rendering", () => {
    let editingState: State<boolean>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const editing = state(false);
      editingState = editing;
      return {
        render() {
          if (editing.get()) {
            input({ class: "editor", value: "hello" });
          } else {
            div({ class: "display", onClick: () => editing.set(true) }, () => {
              text("click to edit");
            });
          }
        },
      };
    };

    const { engine, container } = mountStateful(viewFn);
    expect(findByClass(container, "display").length).toBe(1);
    expect(container.getElementsByTagName("input").length).toBe(0);

    // Switch to editing
    editingState!.set(true);
    engine.renderCycle();
    expect(findByClass(container, "display").length).toBe(0);
    expect(container.getElementsByTagName("input").length).toBe(1);

    // Switch back
    editingState!.set(false);
    engine.renderCycle();
    expect(findByClass(container, "display").length).toBe(1);
    expect(container.getElementsByTagName("input").length).toBe(0);
  });

  it("should work with JSON renderer", () => {
    let countState: State<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    const renderer = new JsonRender();
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    new View(viewFn, engine, {}, () => {}, null, null);
    engine.initialRender();

    expect(renderer.root!.children[0]!.props.content).toBe("0");

    countState!.set(7);
    engine.renderCycle();
    expect(renderer.root!.children[0]!.props.content).toBe("7");
  });

  it("should work with String renderer", () => {
    let countState: State<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const count = state(0);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    const renderer = new StringRender();
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    new View(viewFn, engine, {}, () => {}, null, null);
    engine.initialRender();

    expect(renderer.renderToString()).toBe("0");

    countState!.set(99);
    engine.renderCycle();
    expect(renderer.renderToString()).toBe("99");
  });

  it("should reorder DOM when keyed children swap positions", () => {
    type RowData = { id: number; label: string };
    let listState: State<RowData[]>;

    const Row = view<{ item: RowData }>(({ props }) => ({
      update: {
        should(next) {
          return next.item.label !== props.item.label;
        },
      },
      render() {
        div({ class: "row" }, () => {
          text(props.item.label);
        });
      },
    }));

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ state }) => {
      const items = state<RowData[]>([
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
    };

    const { container, engine } = mountStateful(viewFn);
    expect(container.textContent).toBe("ABCDE");

    // Swap items at index 1 and 3: A D C B E
    const data = listState!.get();
    const next = [...data];
    const tmp = next[1]!;
    next[1] = next[3]!;
    next[3] = tmp;
    listState!.set(next);
    engine.renderCycle();

    expect(container.textContent).toBe("ADCBE");
  });
});
