import { record } from "./data-structures/record/Record";
import { DomEngine } from "./DOM/DomEngine";
import { SimpleTodoList } from "./examples/SimpleTodoList/SimpleTodoList";
import "./style.css";

const todoList = record([
  { text: "First" },
  { text: "Second" },
  { text: "Third" },
]);

const engine = new DomEngine(document.querySelector("#app") as HTMLElement);
engine.render(() => {
  SimpleTodoList({
    text: "Hello world",
    todos: todoList,
  });
});

todoList.push({ text: "New item" });

setTimeout(() => {
  todoList[2].text = "123";
}, 1000);
