import { Window } from "happy-dom";
import { view, type ViewFn } from "@/public/view";
import {
  span, text, table, tbody, tr, td, a,
} from "@/public/primitives/primitives";
import { Engine } from "@/internal/engine";
import { type ViewRecord } from "@/internal/internal_view";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "@/render/html_render";
import { $primitive } from "@/public/primitive";

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

// ========== Deeper instrumentation ==========

const timers: Record<string, number> = {};
const counts: Record<string, number> = {};

function track(name: string, t: number) {
  timers[name] = (timers[name] ?? 0) + t;
  counts[name] = (counts[name] ?? 0) + 1;
}

// Patch HtmlRender.render to break down mount vs update
const proto = HtmlRender.prototype as any;
const origRender = proto.render;
proto.render = function (view: ViewRecord) {
  const ref = view.renderRef;
  const label = ref ? "renderer.render(update)" : "renderer.render(mount)";
  const t0 = performance.now();
  origRender.call(this, view);
  track(label, performance.now() - t0);
};

// Instrument Engine.reconcile
const origReconcile = Engine.prototype.reconcile;
Engine.prototype.reconcile = function (view: ViewRecord) {
  const t0 = performance.now();
  origReconcile.call(this, view);
  track("Engine.reconcile", performance.now() - t0);
};

// Count object allocations
let primCount = 0;
let compositeCount = 0;

const origMarkDirty = Engine.prototype.markDirty;
Engine.prototype.markDirty = function (v: ViewRecord) {
  if (!v.renderRef) {
    if (v.viewFn[$primitive]) primCount++;
    else compositeCount++;
  }
  origMarkDirty.call(this, v);
};

// ========== Run ==========

const ROWS = 10_000;

console.log(`=== Renderer Breakdown (${ROWS} rows) ===\n`);

for (const k in timers) { timers[k] = 0; counts[k] = 0; }
primCount = 0; compositeCount = 0;
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

console.log(`Total:              ${total.toFixed(1)}ms`);
console.log(`Views created:      ${compositeCount} composite, ${primCount} primitive`);
console.log(`---`);
const entries = Object.entries(timers).sort((a, b) => b[1] - a[1]);
for (const [name, ms] of entries) {
  const pct = ((ms / total) * 100).toFixed(0);
  const avg = counts[name]! > 0 ? (ms / counts[name]! * 1000).toFixed(1) : "n/a";
  console.log(`${name.padEnd(28)} ${ms.toFixed(1).padStart(8)}ms  ${pct.padStart(3)}%  (${String(counts[name]).padStart(6)} calls, ${avg}μs avg)`);
}
