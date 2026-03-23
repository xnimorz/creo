import { Window } from "happy-dom";
import { view } from "@/public/view";
import {
  span,
  text,
  table,
  tbody,
  tr,
  td,
  a,
} from "@/public/primitives/primitives";
import { Engine } from "@/internal/engine";
import { View } from "@/internal/internal_view";
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
const A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy",
];
const C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange",
];
const N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard",
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
}>(({ props }) => ({
  update: {
    should(next: any) {
      return (
        next.item.label !== props.item.label || next.selected !== props.selected
      );
    },
  },
  render() {
    tr({ class: props.selected ? "danger" : "" }, () => {
      td({ class: "col-md-1" }, () => {
        text(props.item.id);
      });
      td({ class: "col-md-4" }, () => {
        a({ onClick: props.onSelect }, () => {
          text(props.item.label);
        });
      });
      td({ class: "col-md-1" }, () => {
        a({ onClick: props.onRemove }, () => {
          span({ class: "glyphicon glyphicon-remove", "aria-hidden": "true" });
        });
      });
      td({ class: "col-md-6" });
    });
  },
}));

function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  return sorted[Math.ceil((sorted.length * p) / 100) - 1]!;
}

// --- Capture root view ---
let rootView: View;
const origRegister = Engine.prototype.register;
Engine.prototype.register = function (v: View) {
  if (!v.parent) rootView = v;
  origRegister.call(this, v);
};

const container = document.createElement("div");
const renderer = new HtmlRender(container);
const engine = new Engine(renderer);
orchestrator.setCurrentEngine(engine);
let listState: any;
view(({ state }: any) => {
  const list = state([]);
  listState = list;
  return {
    render() {
      table({}, () => {
        tbody({}, () => {
          for (const item of list.get())
            Row({
              key: item.id,
              item,
              selected: false,
              onSelect: () => {},
              onRemove: () => {},
            });
        });
      });
    },
  };
})({} as any);
engine.initialRender();

function countViews(v: View): number {
  let n = 1;
  for (const c of v.virtualDom) n += countViews(c);
  return n;
}

// ========== Memory Leak Check ==========
console.log("=== Memory Leak Check ===\n");

listState.set(buildData(1000));
engine.renderCycle();
console.log(
  `After create 1K: views=${countViews(rootView!)} TRs=${container.getElementsByTagName("tr").length}`,
);

listState.set([]);
engine.renderCycle();
console.log(
  `After clear:     views=${countViews(rootView!)} TRs=${container.getElementsByTagName("tr").length}`,
);

for (let i = 0; i < 10; i++) {
  listState.set(buildData(1000));
  engine.renderCycle();
}
console.log(
  `After 10 cycles: views=${countViews(rootView!)} TRs=${container.getElementsByTagName("tr").length}`,
);

listState.set([]);
engine.renderCycle();
console.log(
  `After clear:     views=${countViews(rootView!)} TRs=${container.getElementsByTagName("tr").length}`,
);

// _prevDom check
listState.set(buildData(100));
engine.renderCycle();
listState.set(buildData(100));
engine.renderCycle();
let prevDomDisposed = 0;
function checkPrev(v: any) {
  if (v._prevDom) {
    for (const old of v._prevDom) {
      if (old._disposed) prevDomDisposed++;
    }
  }
  for (const c of v.virtualDom) checkPrev(c);
}
checkPrev(rootView!);
console.log(
  `\n_prevDom holding disposed: ${prevDomDisposed} ${prevDomDisposed === 0 ? "✓" : "⚠ LEAK"}`,
);

// _vdomNode check
listState.set(buildData(50));
engine.renderCycle();
const views: any[] = [];
function collect(v: any) {
  views.push(v);
  for (const c of v.virtualDom) collect(c);
}
collect(rootView!);
listState.set([]);
engine.renderCycle();
let staleNodes = 0;
for (const v of views) {
  if (v._disposed && v._vdomNode) staleNodes++;
}
console.log(
  `Stale _vdomNode on disposed: ${staleNodes} ${staleNodes === 0 ? "✓" : "⚠ LEAK"}`,
);

// ========== Performance ==========
console.log("\n=== Performance (50 runs, 10K rows) ===\n");

const RUNS = 50;

// Vanilla baseline
const rawTimes: number[] = [];
for (let run = 0; run < RUNS; run++) {
  nextId = 1;
  const rawData = buildData(10_000);
  const c = document.createElement("div");
  const t0 = performance.now();
  const tbl = document.createElement("table");
  const tb = document.createElement("tbody");
  tbl.appendChild(tb);
  for (let i = 0; i < 10_000; i++) {
    const row = rawData[i]!;
    const t = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.className = "col-md-1";
    td1.appendChild(document.createTextNode(String(row.id)));
    const td2 = document.createElement("td");
    td2.className = "col-md-4";
    const a1 = document.createElement("a");
    a1.appendChild(document.createTextNode(row.label));
    td2.appendChild(a1);
    const td3 = document.createElement("td");
    td3.className = "col-md-1";
    const a2 = document.createElement("a");
    const s = document.createElement("span");
    s.className = "glyphicon glyphicon-remove";
    a2.appendChild(s);
    td3.appendChild(a2);
    const td4 = document.createElement("td");
    td4.className = "col-md-6";
    t.appendChild(td1);
    t.appendChild(td2);
    t.appendChild(td3);
    t.appendChild(td4);
    tb.appendChild(t);
  }
  c.appendChild(tbl);
  rawTimes.push(performance.now() - t0);
}

// Framework
const fwkTimes: number[] = [];
for (let run = 0; run < RUNS; run++) {
  nextId = 1;
  const c2 = document.createElement("div");
  const r2 = new HtmlRender(c2);
  const e2 = new Engine(r2) as any;
  orchestrator.setCurrentEngine(e2);
  let ls: any;
  view(({ state }: any) => {
    const list = state([]);
    ls = list;
    return {
      render() {
        table({}, () => {
          tbody({}, () => {
            for (const item of list.get())
              Row({
                key: item.id,
                item,
                selected: false,
                onSelect: () => {},
                onRemove: () => {},
              });
          });
        });
      },
    };
  })({} as any);
  e2.initialRender();
  const data = buildData(10_000);
  ls.set(data);
  const t0 = performance.now();
  e2.renderCycle();
  fwkTimes.push(performance.now() - t0);
}

const rawP50 = percentile(rawTimes, 50);
const rawP90 = percentile(rawTimes, 90);
const fwkP50 = percentile(fwkTimes, 50);
const fwkP90 = percentile(fwkTimes, 90);

console.log(`               P50        P90        min`);
console.log(
  `Vanilla:     ${rawP50.toFixed(1).padStart(6)}ms   ${rawP90.toFixed(1).padStart(6)}ms   ${Math.min(
    ...rawTimes,
  )
    .toFixed(1)
    .padStart(6)}ms`,
);
console.log(
  `Framework:   ${fwkP50.toFixed(1).padStart(6)}ms   ${fwkP90.toFixed(1).padStart(6)}ms   ${Math.min(
    ...fwkTimes,
  )
    .toFixed(1)
    .padStart(6)}ms`,
);
console.log(`Ratio P50:   ${(fwkP50 / rawP50).toFixed(2)}x`);
console.log(`Ratio P90:   ${(fwkP90 / rawP90).toFixed(2)}x`);
