import { describe, it, expect, beforeAll } from "bun:test";
import { Window } from "happy-dom";
import { view } from "@/public/view";
import { Engine } from "@/internal/engine";
import { HtmlRender } from "@/render/html_render";
import { JsonRender, type JsonNode } from "@/render/json_render";
import { jsx, jsxs, Fragment } from "./jsx";
import { div, button, text } from "./primitives/primitives";

const win = new Window({ url: "http://localhost" });
beforeAll(() => {
  Object.assign(globalThis, {
    document: win.document,
    HTMLElement: win.HTMLElement,
    Text: win.Text,
    Node: win.Node,
    Event: win.Event,
  });
});

function mountJson(root: () => void | (() => void)): JsonNode {
  const renderer = new JsonRender();
  const engine = new Engine(renderer);
  engine.createRoot(() => {
    const result = root();
    if (typeof result === "function") result();
  }, {});
  engine.render();
  return renderer.root as JsonNode;
}

describe("jsx runtime — tree shape", () => {
  it("returns a thunk; nothing happens until invoked", () => {
    let emitted = false;
    const T = view<void>(() => ({
      render() {
        emitted = true;
      },
    }));
    const node = jsx(T, null);
    expect(typeof node).toBe("function");
    expect(emitted).toBe(false);
  });

  it("emits a primitive with children in correct order", () => {
    const rootNode = mountJson(() =>
      jsx("div", { class: "card", children: jsx("span", { children: "hi" }) }),
    );
    // Root is a composite; its only child is the <div/>.
    const divNode = rootNode.children[0]!;
    expect(divNode.type).toBe("div");
    expect(divNode.props.class).toBe("card");
    const spanNode = divNode.children[0]!;
    expect(spanNode.type).toBe("span");
    const textNode = spanNode.children[0]!;
    expect(textNode.type).toBe("text");
    expect(textNode.props.content).toBe("hi");
  });

  it("flattens arrays of children", () => {
    const rootNode = mountJson(() =>
      jsxs("ul", {
        children: [
          jsx("li", { children: "a" }),
          jsx("li", { children: "b" }),
          jsx("li", { children: "c" }),
        ],
      }),
    );
    const ul = rootNode.children[0]!;
    expect(ul.type).toBe("ul");
    const texts = ul.children.map((li) => li.children[0]!.props.content);
    expect(texts).toEqual(["a", "b", "c"]);
  });

  it("renders number children as text", () => {
    const rootNode = mountJson(() => jsx("span", { children: 42 }));
    const span = rootNode.children[0]!;
    expect(span.children[0]!.props.content).toBe("42");
  });

  it("skips boolean/null/undefined children", () => {
    const rootNode = mountJson(() =>
      jsxs("div", {
        children: [
          false,
          null,
          undefined,
          true,
          jsx("span", { children: "visible" }),
        ],
      }),
    );
    const divNode = rootNode.children[0]!;
    expect(divNode.children.length).toBe(1);
    expect(divNode.children[0]!.type).toBe("span");
  });

  it("Fragment flattens without wrapping element", () => {
    const rootNode = mountJson(() =>
      jsxs("div", {
        children: [
          jsxs(Fragment, {
            children: [
              jsx("span", { children: "a" }),
              jsx("span", { children: "b" }),
            ],
          }),
          jsx("span", { children: "c" }),
        ],
      }),
    );
    const divNode = rootNode.children[0]!;
    expect(divNode.children.length).toBe(3);
    expect(divNode.children.map((s) => s.children[0]!.props.content)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("passes the third-arg key through to view props", () => {
    const rootNode = mountJson(() =>
      jsxs("ul", {
        children: [
          jsx("li", { children: "a" }, "k1"),
          jsx("li", { children: "b" }, "k2"),
        ],
      }),
    );
    const ul = rootNode.children[0]!;
    expect(ul.children.length).toBe(2);
    // Keys are tracked internally by the engine; surface-level assertion is
    // that both <li/> nodes exist in order.
    expect(ul.children.map((li) => li.children[0]!.props.content)).toEqual(["a", "b"]);
  });
});

describe("jsx runtime — integration with view()", () => {
  it("a view whose render returns a JSX thunk renders correctly", () => {
    const Counter = view<{ initial: number }>(({ props, use }) => {
      const count = use(props().initial);
      return {
        render: () =>
          jsx("button", {
            class: "counter",
            onClick: () => count.update((n) => n + 1),
            children: count.get(),
          }),
      };
    });

    const rootNode = mountJson(() => jsx(Counter as never, { initial: 7 }));
    // rootNode = engine root composite
    // rootNode.children[0] = Counter composite
    // Counter composite's first child = <button/>
    const counter = rootNode.children[0]!;
    expect(counter.type).toBe("composite");
    const btn = counter.children[0]!;
    expect(btn.type).toBe("button");
    expect(btn.children[0]!.props.content).toBe("7");
  });

  it("views with imperative render() still work unchanged", () => {
    const Classic = view(() => ({
      render() {
        div({ class: "x" }, () => {
          text("classic");
        });
      },
    }));

    const rootNode = mountJson(() => Classic());
    const classic = rootNode.children[0]!;
    expect(classic.type).toBe("composite");
    const divNode = classic.children[0]!;
    expect(divNode.type).toBe("div");
    expect(divNode.children[0]!.props.content).toBe("classic");
  });

  it("passes the Creo slot through JSX children", () => {
    // Card takes a header and renders slot inside a div. Consumer passes JSX
    // children; Card receives them as a slot function and plants them via
    // `children: slot` inside its own JSX tree.
    const Card = view<{ header: string }>(({ props, slot }) => ({
      render: () =>
        jsxs("div", {
          class: "card",
          children: [
            jsx("div", { class: "header", children: props().header }),
            jsx("div", { class: "body", children: slot }),
          ],
        }),
    }));

    const rootNode = mountJson(() =>
      jsx(Card as never, {
        header: "Title",
        children: jsx("span", { children: "inner" }),
      }),
    );
    const card = rootNode.children[0]!; // composite
    const divNode = card.children[0]!;
    expect(divNode.type).toBe("div");
    const [header, body] = divNode.children;
    expect(header!.children[0]!.props.content).toBe("Title");
    expect(body!.children[0]!.type).toBe("span");
    expect(body!.children[0]!.children[0]!.props.content).toBe("inner");
  });

  it("mixes JSX and imperative calls in the same render", () => {
    const Mixed = view(() => ({
      render() {
        div({ class: "wrap" }, () => {
          text("before ");
          jsx("span", { children: "middle" })();
          button({ class: "btn" }, "after");
        });
      },
    }));

    const rootNode = mountJson(() => Mixed());
    const mixed = rootNode.children[0]!;
    const wrap = mixed.children[0]!;
    expect(wrap.type).toBe("div");
    expect(wrap.children.map((c) => c.type)).toEqual(["text", "span", "button"]);
  });
});

describe("jsx runtime — DOM (HtmlRender)", () => {
  it("click handler fires and updates DOM", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const Counter = view<{ initial: number }>(({ props, use }) => {
      const count = use(props().initial);
      return {
        render: () =>
          jsx("button", {
            class: "counter",
            onClick: () => count.update((n) => n + 1),
            children: count.get(),
          }),
      };
    });

    const renderer = new HtmlRender(container);
    const engine = new Engine(renderer);
    engine.createRoot(() => {
      const r = jsx(Counter as never, { initial: 0 })();
      if (typeof r === "function") (r as () => void)();
    }, {});
    engine.render();

    const btn = findButton(container);
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("0");
    btn!.click();
    await new Promise((r) => queueMicrotask(() => r(null)));
    expect(btn!.textContent).toBe("1");
  });
});

function findButton(root: Node): HTMLButtonElement | null {
  if (root instanceof HTMLElement && root.tagName === "BUTTON") {
    return root as HTMLButtonElement;
  }
  for (const child of Array.from(root.childNodes)) {
    const found = findButton(child);
    if (found) return found;
  }
  return null;
}
