import { Window } from "happy-dom";
import { view, type ViewFn } from "@/public/view";
import {
  span, text, table, tbody, tr, td, a,
} from "@/public/primitives/primitives";
import { Engine } from "@/internal/engine";
import { type ViewRecord } from "@/internal/internal_view";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "@/render/html_render";

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

const random = (max: number) => Math.round(Math.random() * 1000) % max;
const A = ["pretty","large","big","small","tall","short","long","handsome","plain","quaint","clean","elegant","easy","angry","crazy","helpful","mushy","odd","unsightly","adorable","important","inexpensive","cheap","expensive","fancy"];
const C = ["red","yellow","blue","green","pink","brown","purple","brown","white","black","orange"];
const N = ["table","chair","house","bbq","desk","car","pony","cookie","sandwich","burger","pizza","mouse","keyboard"];
let nextId = 1;
type RowData = { id: number; label: string };
const buildData = (count: number): RowData[] => {
  const data = new Array<RowData>(count);
  for (let i = 0; i < count; i++) {
    data[i] = { id: nextId++, label: `${A[random(A.length)]} ${C[random(C.length)]} ${N[random(N.length)]}` };
  }
  return data;
};

const Row = view<{
  item: RowData; selected: boolean; onSelect: () => void; onRemove: () => void;
}>((ctx) => ({
  update: {
    should(next: any) {
      return next.item.label !== ctx.props().item.label || next.selected !== ctx.props().selected;
    },
  },
  render() {
    tr({ class: ctx.props().selected ? "danger" : "" }, () => {
      td({ class: "col-md-1" }, () => { text(ctx.props().item.id); });
      td({ class: "col-md-4" }, () => {
        a({ onClick: ctx.props().onSelect }, () => { text(ctx.props().item.label); });
      });
      td({ class: "col-md-1" }, () => {
        a({ onClick: ctx.props().onRemove }, () => {
          span({ class: "glyphicon glyphicon-remove", "aria-hidden": "true" });
        });
      });
      td({ class: "col-md-6" });
    });
  },
}));

// ========== Instrument key methods ==========

const timers: Record<string, number> = {};
const counts: Record<string, number> = {};

function track(name: string, t: number) {
  timers[name] = (timers[name] ?? 0) + t;
  counts[name] = (counts[name] ?? 0) + 1;
}

// Instrument Engine.render phases
const origRenderLoop = Engine.prototype.render;
Engine.prototype.render = function () {
  const t0 = performance.now();
  origRenderLoop.call(this);
  track("renderLoop_total", performance.now() - t0);
};

// Instrument renderer.render
const origHtmlRender = HtmlRender.prototype.render;
HtmlRender.prototype.render = function (view: ViewRecord) {
  const t0 = performance.now();
  origHtmlRender.call(this, view);
  track("renderer.render", performance.now() - t0);
};

// Instrument Engine.reconcile
const origReconcile = Engine.prototype.reconcile;
Engine.prototype.reconcile = function (view: ViewRecord) {
  const t0 = performance.now();
  origReconcile.call(this, view);
  track("Engine.reconcile", performance.now() - t0);
};

// ========== Run ==========

const RUNS = 10;
const ROWS = 10_000;

console.log(`=== Performance Breakdown (${RUNS} runs, ${ROWS} rows) ===\n`);

for (let run = 0; run < RUNS; run++) {
  // Reset
  for (const k in timers) { timers[k] = 0; counts[k] = 0; }
  nextId = 1;

  const c = document.createElement("div");
  const r = new HtmlRender(c);
  const e = new Engine(r);
  orchestrator.setCurrentEngine(e);
  let ls: any;
  const appViewFn: ViewFn<any, any> = ({ use }) => {
    const list = use<RowData[]>([]);
    ls = list;
    return {
      render() {
        table({}, () => {
          tbody({}, () => {
            for (const item of list.get())
              Row({ key: item.id, item, selected: false, onSelect: () => {}, onRemove: () => {} });
          });
        });
      },
    };
  };
  e.createRoot(() => {
    orchestrator.currentEngine()!.view(appViewFn, {}, null, null);
  }, {});
  e.render();

  const data = buildData(ROWS);
  ls.set(data);
  const t0 = performance.now();
  e.render();
  const total = performance.now() - t0;

  if (run === RUNS - 1) {
    console.log(`Total:              ${total.toFixed(1)}ms`);
    console.log(`---`);
    const entries = Object.entries(timers).sort((a, b) => b[1] - a[1]);
    for (const [name, ms] of entries) {
      const pct = ((ms / total) * 100).toFixed(0);
      console.log(`${name.padEnd(22)} ${ms.toFixed(1).padStart(8)}ms  ${pct.padStart(3)}%  (${counts[name]} calls)`);
    }
  }
}
