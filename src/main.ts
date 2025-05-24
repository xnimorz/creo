import { record } from "./data-structures/record/Record";
import { HtmlEngine } from "./engine/HtmlEngine";
import { SimpleStringEngine } from "./engine/SimpleStringEngine";
import { SimpleTodoList } from "./examples/SimpleTodoList/SimpleTodoList";
import "./style.css";

const todoList = record([
  { text: "First" },
  { text: "Second" },
  { text: "Third" },
]);
// const stringEngine = new SimpleStringEngine();
// stringEngine.render(() => {
//   SimpleTodoList({
//     text: "Hello world",
//     todos: todoList,
//   });
// });
// console.log(stringEngine.renderResult());

const htmlEngine = new HtmlEngine(
  document.querySelector("#app") as HTMLElement,
);
htmlEngine.render(() => {
  SimpleTodoList({
    text: "Hello world",
    todos: todoList,
  });
});

todoList.push({ text: "New item" });
todoList[2].text = "123";
