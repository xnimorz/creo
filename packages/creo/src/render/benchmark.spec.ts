import { describe, it, expect } from "bun:test";
import { Window } from "happy-dom";
import { view, type ViewFn } from "@/public/view";
import {
  div,
  span,
  text,
  table,
  tbody,
  tr,
  td,
  a,
} from "@/public/primitives/primitives";
import type { Reactive } from "@/public/state";
import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "./html_render";
import type { Wildcard } from "@/internal/wildcard";

// ---------------------------------------------------------------------------
// Happy-dom setup
// ---------------------------------------------------------------------------

const win = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  document: win.document,
  HTMLElement: win.HTMLElement,
  Text: win.Text,
  HTMLInputElement: win.HTMLInputElement,
  DocumentFragment: win.DocumentFragment,
  Comment: win.Comment,
  Node: win.Node,
  Event: win.Event,
});

// ---------------------------------------------------------------------------
// Benchmark app (mirrors examples/benchmark)
// ---------------------------------------------------------------------------

const random = (max: number) => Math.round(Math.random() * 1000) % max;

const A = [
  "pretty", "large", "big", "small", "tall", "short", "long", "handsome",
  "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful",
  "mushy", "odd", "unsightly", "adorable", "important", "inexpensive",
  "cheap", "expensive", "fancy",
];
const C = [
  "red", "yellow", "blue", "green", "pink", "brown", "purple", "brown",
  "white", "black", "orange",
];
const N = [
  "table", "chair", "house", "bbq", "desk", "car", "pony", "cookie",
  "sandwich", "burger", "pizza", "mouse", "keyboard",
];

let nextId = 1;
type RowData = { id: number; label: string };

const buildData = (count: number): RowData[] => {
  const data = new Array<RowData>(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: nextId++,
      label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}`,
    };
  }
  return data;
};

const Row = view<{
  item: RowData;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}>((ctx) => ({
  shouldUpdate(next) {
    return (
      next.item.label !== ctx.props().item.label ||
      next.selected !== ctx.props().selected
    );
  },
  render() {
    tr({ class: ctx.props().selected ? "danger" : "" }, () => {
      td({ class: "col-md-1" }, () => {
        text(ctx.props().item.id);
      });
      td({ class: "col-md-4" }, () => {
        a({ on: { click: ctx.props().onSelect } }, () => {
          text(ctx.props().item.label);
        });
      });
      td({ class: "col-md-1" }, () => {
        a({ on: { click: ctx.props().onRemove } }, () => {
          span({
            class: "glyphicon glyphicon-remove",
            "aria-hidden": "true",
          });
        });
      });
      td({ class: "col-md-6" });
    });
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createBenchApp() {
  let listState: Reactive<RowData[]>;
  let selectedIdState: Reactive<number>;

  const appViewFn: ViewFn<Wildcard, Wildcard> = ({ use }) => {
    const list = use<RowData[]>([]);
    const selectedId = use(0);
    listState = list;
    selectedIdState = selectedId;

    const select = (id: number) => selectedId.set(id);
    const remove = (id: number) =>
      list.set(list.get().filter((i) => i.id !== id));

    return {
      render() {
        table({ class: "table table-hover table-striped test-data" }, () => {
          tbody({}, () => {
            const data = list.get();
            const sel = selectedId.get();
            for (const item of data) {
              Row({
                key: item.id,
                item,
                selected: sel === item.id,
                onSelect: () => select(item.id),
                onRemove: () => remove(item.id),
              });
            }
          });
        });
      },
    };
  };

  const container = document.createElement("div");
  const renderer = new HtmlRender(container);
  const engine = new Engine(renderer);
  orchestrator.setCurrentEngine(engine);
  engine.createRoot(() => {
    orchestrator.currentEngine()!.view(appViewFn, {}, null, null);
  }, {});
  engine.render();

  return {
    container,
    engine,
    get list() {
      return listState;
    },
    get selectedId() {
      return selectedIdState;
    },
  };
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function countElements(root: Node, tag: string): number {
  return (root as HTMLElement).getElementsByTagName(tag).length;
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe("Benchmark", () => {
  it("create 1,000 rows", () => {
    const app = createBenchApp();

    const ms = time(() => {
      app.list.set(buildData(1000));
      app.engine.render();
    });

    expect(countElements(app.container, "tr")).toBe(1000);
    console.log(`  create 1,000 rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it("create 10,000 rows", () => {
    const app = createBenchApp();

    const ms = time(() => {
      app.list.set(buildData(10_000));
      app.engine.render();
    });

    expect(countElements(app.container, "tr")).toBe(10_000);
    console.log(`  create 10,000 rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(30000); // happy-dom is slow for 10k rows
  });

  it("append 1,000 rows to 1,000", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();

    const ms = time(() => {
      app.list.set(app.list.get().concat(buildData(1000)));
      app.engine.render();
    });

    expect(countElements(app.container, "tr")).toBe(2000);
    console.log(`  append 1,000 rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000);
  });

  it("update every 10th row (1,000 rows)", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();

    const ms = time(() => {
      const data = app.list.get();
      const next = data.slice();
      for (let i = 0; i < next.length; i += 10) {
        const r = next[i]!;
        next[i] = { id: r.id, label: r.label + " !!!" };
      }
      app.list.set(next);
      app.engine.render();
    });

    console.log(`  update every 10th row: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(500);
  });

  it("swap rows (1,000 rows)", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();

    // Verify initial order
    const trs = app.container.getElementsByTagName("tr");
    const firstLabel = trs[1]?.textContent;
    const lastLabel = trs[998]?.textContent;

    const ms = time(() => {
      const data = app.list.get();
      const next = data.slice();
      const tmp = next[1]!;
      next[1] = next[998]!;
      next[998] = tmp;
      app.list.set(next);
      app.engine.render();
    });

    // Verify swap happened in DOM
    const trsAfter = app.container.getElementsByTagName("tr");
    expect(trsAfter[1]?.textContent).toBe(lastLabel);
    expect(trsAfter[998]?.textContent).toBe(firstLabel);

    console.log(`  swap rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(500);
  });

  it("select row (1,000 rows)", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();

    const ms = time(() => {
      const data = app.list.get();
      app.selectedId.set(data[5]!.id);
      app.engine.render();
    });

    console.log(`  select row: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(500);
  });

  it("clear 1,000 rows", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();
    expect(countElements(app.container, "tr")).toBe(1000);

    const ms = time(() => {
      app.list.set([]);
      app.engine.render();
    });

    expect(countElements(app.container, "tr")).toBe(0);
    console.log(`  clear 1,000 rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(500);
  });

  it("replace 1,000 rows", () => {
    const app = createBenchApp();
    app.list.set(buildData(1000));
    app.engine.render();

    const ms = time(() => {
      app.list.set(buildData(1000));
      app.engine.render();
    });

    expect(countElements(app.container, "tr")).toBe(1000);
    console.log(`  replace 1,000 rows: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000);
  });
});
