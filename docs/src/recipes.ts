import counter from "../recipes/counter.ts?raw";
import todo from "../recipes/todo.ts?raw";
import storeDemo from "../recipes/store.ts?raw";
import fetching from "../recipes/fetching.ts?raw";
import suspense from "../recipes/suspense.ts?raw";

export type Recipe = {
  id: string;
  title: string;
  description: string;
  source: string;
  css?: string;
};

const counterCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f7f8fa; color: #1a1a1a; }
.counter { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; background: #fff; border-radius: 12px; max-width: 280px; margin: 40px auto; box-shadow: 0 4px 12px rgba(0,0,0,.05); }
.count { font-size: 48px; font-weight: 700; color: #4a90d9; }
.controls { display: flex; gap: 8px; }
button { padding: 8px 16px; border-radius: 6px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 14px; }
button:hover { background: #f3f4f6; border-color: #bbb; }
`;

const todoCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f7f8fa; color: #1a1a1a; }
.todo { max-width: 420px; margin: 20px auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.05); }
.row { display: flex; gap: 8px; margin-bottom: 12px; }
.row input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.row button { padding: 8px 16px; background: #4a90d9; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
.list { list-style: none; padding: 0; margin: 0; }
.list li { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
.list li.done .title { text-decoration: line-through; color: #999; }
.title { flex: 1; }
.remove { background: none; border: 0; font-size: 18px; cursor: pointer; color: #c33; opacity: .5; }
.remove:hover { opacity: 1; }
`;

const storeCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f7f8fa; color: #1a1a1a; }
.shell { max-width: 360px; margin: 40px auto; display: flex; flex-direction: column; gap: 16px; }
.display { padding: 24px; border-radius: 12px; font-size: 20px; text-align: center; transition: background .2s, color .2s; display: flex; justify-content: center; gap: 8px; }
.display[data-theme="light"] { background: #fff; color: #1a1a1a; box-shadow: 0 4px 12px rgba(0,0,0,.05); }
.display[data-theme="dark"] { background: #1a1a1a; color: #fff; }
.label { opacity: .6; }
.value { font-weight: 700; }
.controls { display: flex; gap: 8px; justify-content: center; }
.controls button { padding: 8px 14px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; }
.controls button:hover { border-color: #4a90d9; color: #4a90d9; }
`;

const fetchingCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f7f8fa; color: #1a1a1a; }
.card { max-width: 420px; margin: 40px auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,.05); }
.card h2 { margin: 0 0 12px; font-size: 16px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.quote { font-size: 18px; line-height: 1.5; margin: 0 0 8px; }
.author { color: #888; margin: 0 0 16px; font-size: 14px; }
.muted { color: #999; }
.error { color: #c33; }
button { padding: 8px 16px; background: #4a90d9; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
`;

export const recipes: Recipe[] = [
  {
    id: "counter",
    title: "Counter",
    description: "State basics — use(), .set(), .update().",
    source: counter,
    css: counterCss,
  },
  {
    id: "todo",
    title: "Todo list",
    description: "Keyed list reconciliation, inputs, events.",
    source: todo,
    css: todoCss,
  },
  {
    id: "store",
    title: "Global store",
    description: "Shared reactive state across views.",
    source: storeDemo,
    css: storeCss,
  },
  {
    id: "fetching",
    title: "Data fetching",
    description: "Async load with loading + error states.",
    source: fetching,
    css: fetchingCss,
  },
  {
    id: "suspense",
    title: "Suspense pattern",
    description: "Reusable Suspense view wrapping load/fallback/error.",
    source: suspense,
    css: fetchingCss,
  },
];

export function findRecipe(id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}
