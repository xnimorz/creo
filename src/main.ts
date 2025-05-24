import { record } from "./data-structures/record/Record";
import { HtmlEngine } from "./engine/HtmlEngine";
import { SimpleStringEngine } from "./engine/SimpleStringEngine";
import { SimpleTodoList } from "./examples/SimpleTodoList/SimpleTodoList";
import "./style.css";

// const stringEngine = new SimpleStringEngine();
// stringEngine.render(() => {
//   SimpleTodoList({ text: "Hello world" });
// });
// console.log(stringEngine.renderResult());

const htmlEngine = new HtmlEngine(
  document.querySelector("#app") as HTMLElement,
);
const todoList = record([
  { text: "First" },
  { text: "Second" },
  { text: "Third" },
]);
htmlEngine.render(() => {
  SimpleTodoList({
    text: "Hello world",
    todos: todoList,
  });
});

todoList.push({ text: "New item" });
queueMicrotask(() => {
  htmlEngine.forceRerender();
  htmlEngine.debugStatus();
});
