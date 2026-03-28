import { describe, it, expect, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import type { ViewFn } from "@/public/view";
import { view } from "@/public/view";
import { div, span, text, button, input } from "@/public/primitives/primitives";
import type { Reactive } from "@/public/state";
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

const todoAppViewFn: ViewFn<Wildcard, Wildcard> = (ctx) => ({
  render() {
    div({ class: "app" }, () => {
      (ctx.props().items as TodoItem[]).forEach((item: TodoItem) => {
        TodoItemCall({ ...item, key: item.id });
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
    { items },
    null,
    engine,
    null,
    null,
  );
  engine.render();
  return { engine, rootView, items };
}

function rerender(engine: Engine, rootView: View, newItems: TodoItem[]) {
  rootView.props = { items: newItems };
  rootView.markDirty();
  engine.render();
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
    new View(clickViewFn, {}, null, e, null, null);
    e.render();

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
    new View(viewFn, {}, null, engine, null, null);
    engine.render();
    return { container, engine };
  }

  it("should render initial state", () => {
    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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
    let countState: Reactive<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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
    engine.render();
    expect(container.textContent).toBe("42");
  });

  it("should apply state immediately on set", () => {
    let countState: Reactive<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(10);
      countState = count;
      return {
        render() {
          text(count.get());
        },
      };
    };

    mountStateful(viewFn);

    countState!.set(99);
    // State is immediate — get() returns new value right away
    expect(countState!.get()).toBe(99);
  });

  it("should batch multiple sets into one render", () => {
    let countState: Reactive<number>;
    let renderCount = 0;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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
    engine.render();

    expect(countState!.get()).toBe(3);
    expect(renderCount).toBe(1);
  });

  it("should chain updates through pending", () => {
    let countState: Reactive<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const items = use<string[]>(["one", "two"]);
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
    engine.render();
    expect(findByClass(container, "item").length).toBe(3);
    expect(container.textContent).toContain("three");

    // Remove item
    itemsState!.update((items) => items.filter((i) => i !== "two"));
    engine.render();
    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).not.toContain("two");
  });

  it("should handle state-driven conditional rendering", () => {
    let editingState: Reactive<boolean>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const editing = use(false);
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
    engine.render();
    expect(findByClass(container, "display").length).toBe(0);
    expect(container.getElementsByTagName("input").length).toBe(1);

    // Switch back
    editingState!.set(false);
    engine.render();
    expect(findByClass(container, "display").length).toBe(1);
    expect(container.getElementsByTagName("input").length).toBe(0);
  });

  it("should work with JSON renderer", () => {
    let countState: Reactive<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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
    new View(viewFn, {}, null, engine, null, null);
    engine.render();

    expect(renderer.root!.children[0]!.props.content).toBe(0);

    countState!.set(7);
    engine.render();
    expect(renderer.root!.children[0]!.props.content).toBe(7);
  });

  it("should work with String renderer", () => {
    let countState: Reactive<number>;

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
      const count = use(0);
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
    new View(viewFn, {}, null, engine, null, null);
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

    const viewFn: ViewFn<Wildcard, Wildcard> = () => ({
      render() {
        Card({ title: "Hello" }, () => {
          span({ class: "child" }, () => {
            text("child content");
          });
        });
      },
    });

    const container = document.createElement("div");
    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    new View(viewFn, {}, null, engine, null, null);
    engine.render();

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

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
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
    };

    const { container, engine } = mountStateful(viewFn);
    expect(findByClass(container, "active").length).toBe(0);
    expect(findByClass(container, "item").length).toBe(3);

    // Highlight Y — prop change must propagate through Wrapper
    activeState!.set("Y");
    engine.render();
    expect(findByClass(container, "active").length).toBe(1);
    expect(findByClass(container, "active")[0]!.textContent).toBe("Y");

    // Switch to Z
    activeState!.set("Z");
    engine.render();
    expect(findByClass(container, "active").length).toBe(1);
    expect(findByClass(container, "active")[0]!.textContent).toBe("Z");

    // Clear
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

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
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
    };

    const container = document.createElement("div");
    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    orchestrator.setCurrentEngine(engine);
    new View(viewFn, {}, null, engine, null, null);
    engine.render();

    expect(findByClass(container, "item").length).toBe(2);
    expect(container.textContent).toContain("one");
    expect(container.textContent).toContain("two");

    // Update children
    itemsState!.update((items) => [...items, "three"]);
    engine.render();

    expect(findByClass(container, "item").length).toBe(3);
    expect(container.textContent).toContain("three");

    // Remove children
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

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
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
    };

    const { container, engine } = mountStateful(viewFn);
    const list = findByClass(container, "list")[0]!;

    // Initial: all display
    expect(list.textContent).toBe("ABC");

    // Edit B → should stay between A and C
    editingState!.set("B");
    engine.render();
    const displays = findByClass(list, "display");
    const editors = list.getElementsByTagName("input");
    expect(displays.length).toBe(2);
    expect(editors.length).toBe(1);
    expect(displays[0]!.textContent).toBe("A");
    expect(displays[1]!.textContent).toBe("C");
    expect(
      displays[0]!.compareDocumentPosition(editors[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      editors[0]!.compareDocumentPosition(displays[1]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Stop editing → B goes back to display, must keep A B C order
    editingState!.set(null);
    engine.render();
    expect(list.textContent).toBe("ABC");

    // Edit A → should stay first
    editingState!.set("A");
    engine.render();
    {
      const d = findByClass(list, "display");
      expect(d.length).toBe(2);
      expect(d[0]!.textContent).toBe("B");
      expect(d[1]!.textContent).toBe("C");
    }

    // Switch from editing A to editing C in one step
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
        div({ class: "display" }, () => { text(props().label); });
      },
    }));
    const Editor = view<{ label: string }>(({ props }) => ({
      render() {
        input({ class: "editor", value: props().label });
      },
    }));

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
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
    };

    const { container, engine } = mountStateful(viewFn);
    const list = findByClass(container, "list")[0]!;
    expect(list.textContent).toBe("ABC");

    // Step 1: reorder [A, B, C] → [B, C, A]
    listState!.set(["B", "C", "A"]);
    engine.render();
    expect(list.textContent).toBe("BCA");

    // Step 2: click edit on B — must NOT rearrange
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
        e[0]!.compareDocumentPosition(d[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    // Step 3: stop editing — back to [B, C, A] display
    editingState!.set(null);
    engine.render();
    expect(list.textContent).toBe("BCA");
  });

  it("should reorder DOM when keyed children swap positions", () => {
    type RowData = { id: number; label: string };
    let listState: Reactive<RowData[]>;

    const Row = view<{ item: RowData }>((ctx) => ({
      update: {
        should(next: { item: RowData }) {
          return next.item.label !== ctx.props().item.label;
        },
      },
      render() {
        div({ class: "row" }, () => {
          text(ctx.props().item.label);
        });
      },
    }));

    const viewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
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
    engine.render();

    expect(container.textContent).toBe("ADCBE");
  });
});
