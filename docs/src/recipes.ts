import counter from "../recipes/counter.ts?raw";
import simpleTodo from "../recipes/simple-todo.ts?raw";
import advancedTodo from "../recipes/advanced-todo.ts?raw";
import storeDemo from "../recipes/store.ts?raw";
import fetching from "../recipes/fetching.ts?raw";
import suspense from "../recipes/suspense.ts?raw";
import formControls from "../recipes/form-controls.ts?raw";
import table from "../recipes/table.ts?raw";
import chess from "../recipes/chess.ts?raw";

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

const formControlsCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f7f8fa; color: #1a1a1a; }
.form-controls { max-width: 560px; margin: 20px auto; display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,.05); }
.card h2 { margin: 0 0 12px; font-size: 13px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.row:last-child { margin-bottom: 0; }
.label { font-size: 14px; cursor: pointer; user-select: none; }
label.label:hover { color: #4a90d9; }
input[type="checkbox"], input[type="radio"] { cursor: pointer; }
.tag { font-family: ui-monospace, monospace; font-size: 12px; padding: 3px 8px; background: #f0f6ff; border: 1px solid #c8dcf5; border-radius: 4px; color: #1a4480; }
.tag.on { background: #e7f7ec; border-color: #b6e2c0; color: #146c2e; }
.txt { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; width: 200px; }
.txt:focus { outline: 2px solid #4a90d9; outline-offset: -1px; }
.ring { padding: 6px; border-radius: 6px; transition: background .15s; }
.ring.focused { background: #fff8d4; }
.note { font-size: 12px; color: #777; margin: 4px 0 0; }
button { padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; }
button:hover { background: #f3f4f6; border-color: #4a90d9; color: #4a90d9; }
audio, video { max-width: 100%; display: block; margin-bottom: 8px; }
`;

// Advanced todo with drag-and-drop reordering — CSS lifted from
// examples/todo/index.html.
const advancedTodoCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f5f5f5; color: #1a1a1a; display: flex; justify-content: center; }
.app { max-width: 480px; width: 100%; }
h1 { font-size: 24px; margin-bottom: 16px; }
.add-form { display: flex; gap: 8px; margin-bottom: 16px; }
.add-input { flex: 1; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
.add-input:focus { outline: 2px solid #4a90d9; outline-offset: -1px; }
.btn { padding: 8px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 14px; }
.btn:hover { background: #eee; }
.btn-primary { background: #4a90d9; color: #fff; border-color: #4a90d9; }
.btn-primary:hover { background: #357abd; }
.card { background: #fff; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.card-header { padding: 12px 16px; font-weight: 600; font-size: 14px; background: #f9f9f9; border-bottom: 1px solid #ddd; }
.card-body { padding: 0; }
.todo-item { display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 14px; transition: background 0.1s; user-select: none; }
.todo-item:not(:last-child) { border-bottom: 1px solid #eee; }
.todo-item.done .todo-text { text-decoration: line-through; color: #999; }
.todo-item.dragging { opacity: 0.25; }
.todo-item.drop-above { box-shadow: inset 0 3px 0 #4a90d9; background: #f0f6ff; }
.todo-item.drop-below { box-shadow: inset 0 -3px 0 #4a90d9; background: #f0f6ff; }
.dragging-active { cursor: grabbing; }
.dragging-active * { cursor: grabbing !important; }
.drag-ghost { position: fixed; transform: translate(-16px, -50%); pointer-events: none; z-index: 1000; display: flex; align-items: center; gap: 10px; padding: 10px 16px; font-size: 14px; background: #fff; border: 1px solid #4a90d9; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); opacity: 0.92; white-space: nowrap; max-width: 400px; }
.todo-item.editing { padding: 6px 16px; }
.drag-handle { cursor: grab; color: #aaa; font-size: 16px; line-height: 1; padding: 2px 0; }
.drag-handle:hover { color: #666; }
.todo-check { cursor: pointer; font-size: 16px; line-height: 1; }
.todo-text { flex: 1; cursor: pointer; padding: 2px 0; border-radius: 3px; }
.todo-text:hover { background: #f0f6ff; }
.todo-delete { color: #c44; cursor: pointer; font-size: 16px; line-height: 1; opacity: 0; transition: opacity 0.1s; }
.todo-item:hover .todo-delete { opacity: 1; }
.todo-delete:hover { color: #a00; }
.edit-input { flex: 1; padding: 6px 8px; border: 1px solid #4a90d9; border-radius: 4px; font-size: 14px; font-family: inherit; outline: none; width: 100%; }
.filter-bar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
.btn-filter { font-size: 12px; padding: 4px 10px; }
.empty { padding: 24px 16px; text-align: center; color: #999; font-size: 14px; }
`;

// Editable table — CSS lifted from examples/table/index.html.
const tableCss = `
body { font: 15px system-ui, sans-serif; padding: 24px; background: #f5f5f5; color: #1a1a1a; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.btn { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 14px; }
.btn:hover { background: #eee; }
.table { display: inline-block; border: 1px solid #bbb; border-radius: 4px; overflow: hidden; background: #fff; outline: none; }
.table:focus { border-color: #4a90d9; }
.row { display: flex; }
.row:not(:last-child) { border-bottom: 1px solid #ddd; }
.cell { min-width: 120px; padding: 8px 12px; cursor: pointer; font-size: 14px; min-height: 36px; }
.cell:not(:last-child) { border-right: 1px solid #ddd; }
.cell:hover { background: #f0f6ff; }
.cell.selected { outline: 2px solid #4a90d9; outline-offset: -2px; background: #e8f0fe; }
.header-cell { font-weight: 600; background: #f9f9f9; cursor: default; }
.header-cell:hover { background: #f9f9f9; }
.cell-input { min-width: 120px; width: 120px; padding: 8px 12px; font-size: 14px; border: none; outline: 2px solid #4a90d9; outline-offset: -2px; min-height: 36px; font-family: inherit; background: #fff; }
`;

// Chess — CSS lifted from examples/chess/index.html.
const chessCss = `
body { font: 15px system-ui, -apple-system, sans-serif; padding: 32px; background: #1a1a2e; color: #eee; display: flex; justify-content: center; min-height: 100vh; margin: 0; }
.chess-app { display: flex; flex-direction: column; align-items: center; gap: 12px; user-select: none; }
.header { display: flex; align-items: center; gap: 16px; width: 512px; }
.title { font-size: 22px; font-weight: 700; flex: 1; }
.reset-btn { padding: 6px 14px; border: 1px solid #555; border-radius: 4px; background: #2a2a4a; color: #ccc; cursor: pointer; font-size: 13px; }
.reset-btn:hover { background: #3a3a5a; }
.status-bar { display: flex; align-items: center; gap: 10px; width: 512px; padding: 8px 12px; background: #2a2a4a; border-radius: 6px; font-size: 14px; }
.turn-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #666; }
.turn-dot.white { background: #fff; border-color: #999; }
.turn-dot.black { background: #222; border-color: #666; }
.status-text { flex: 1; }
.board { display: grid; grid-template-columns: repeat(8, 64px); grid-template-rows: repeat(8, 64px); border: 3px solid #444; border-radius: 4px; overflow: hidden; }
.square { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; }
.square.light { background: #f0d9b5; }
.square.dark { background: #b58863; }
.square.selected.light { background: #f7ec5a; }
.square.selected.dark { background: #dbc34a; }
.square.last-move.light { background: #e8d44d88; }
.square.last-move.dark { background: #c8a43088; }
.square.in-check.light, .square.in-check.dark { background: radial-gradient(ellipse at center, #ff4444 0%, #cc000088 60%, transparent 80%); }
.square.valid-target { cursor: pointer; }
.move-dot { width: 18px; height: 18px; border-radius: 50%; background: rgba(0,0,0,0.2); }
.square.capture-target::after { content: ""; position: absolute; inset: 2px; border-radius: 50%; border: 3px solid rgba(0,0,0,0.25); }
.piece { font-size: 46px; line-height: 1; pointer-events: none; text-shadow: 3px 4px 0px rgba(0,0,0,0.2); }
.black-piece { color: #222; }
.white-piece { color: #eee; }
.file-labels { display: grid; grid-template-columns: repeat(8, 64px); width: 512px; }
.file-label { text-align: center; font-size: 12px; color: #888; }
.drag-ghost { position: fixed; transform: translate(-50%, -50%); pointer-events: none; z-index: 1000; font-size: 54px; line-height: 1; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); opacity: 0.9; }
.dragging-active { cursor: grabbing; }
.dragging-active * { cursor: grabbing !important; }
.promo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.promo-dialog { display: flex; gap: 8px; padding: 16px; background: #2a2a4a; border: 2px solid #555; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.promo-btn { width: 72px; height: 72px; font-size: 48px; line-height: 1; display: flex; align-items: center; justify-content: center; border: 2px solid #555; border-radius: 8px; background: #3a3a5a; cursor: pointer; transition: background 0.1s, border-color 0.1s; }
.promo-btn:hover { background: #4a90d9; border-color: #4a90d9; }
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
    id: "simple-todo",
    title: "Simple todo",
    description: "Keyed list reconciliation, inputs, events.",
    source: simpleTodo,
    css: todoCss,
  },
  {
    id: "advanced-todo",
    title: "Advanced todo with drag-and-drop",
    description: "Pointer-driven reordering, inline editing, hide/show filters.",
    source: advancedTodo,
    css: advancedTodoCss,
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
  {
    id: "form-controls",
    title: "Form controls",
    description: "Checkbox, video/audio muted, focus/blur, controlled-input drift.",
    source: formControls,
    css: formControlsCss,
  },
  {
    id: "table",
    title: "Editable table",
    description: "Keyed grid, inline cell editing, keyboard navigation.",
    source: table,
    css: tableCss,
  },
  {
    id: "chess",
    title: "Chess",
    description: "Full chess engine: legal moves, check, mate, drag pieces, castling, en passant, promotion.",
    source: chess,
    css: chessCss,
  },
];

export function findRecipe(id: string): Recipe | undefined {
  return recipes.find((r) => r.id === id);
}
