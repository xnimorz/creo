import { creo } from "../../creo";
import { Block } from "../../ui/html/Block";
import { Inline } from "../../ui/html/Inline";
import { Text } from "../../ui/html/Text";
import { VStack } from "../../ui/html/VStack";
import { _ } from "../../data-structures/null/null";
import { Button } from "../../ui/html/Button";

type Todo = { text: string };

let counter = 0;
export const SimpleTodoList = creo<{ text: string; todos: Array<Todo> }>(
  (c) => {
    const todos: Array<Todo> = c.tracked(c.p.todos);
    return {
      didMount() {
        console.warn("did mount");
        // button?.extension.getButton().addEventListener("click", () => {
        //   todos.push({ text: `New Todo: ${counter++}` });
        // });
      },
      render() {
        console.log("rendering todo list");
        Inline(_, () => {
          Text(c.p.text);
        });
        Block(_, () => {
          Text("Hello inside container");
          VStack(_, () => {
            TodoList({ todos });
          });
        });
        Button(_, () => Text("Add todo"));
      },
    };
  },
);

export const TodoList = creo<{ todos: Array<Todo> }>((c) => {
  const todos: Array<Todo> = c.tracked(c.p.todos);
  return {
    render() {
      console.log("rendering todos");
      todos.map((todo) => {
        Block({ class: "todo" }, () => {
          Text(`Entity: ${todo.text}`);
        });
      });
    },
  };
});
