import { creo } from "../../creo";
import { Block } from "../../ui/html/Block";
import { Inline } from "../../ui/html/Inline";
import { Text } from "../../ui/html/Text";
import { VStack } from "../../ui/html/VStack";
import { _ } from "../../data-structures/null/null";

type Todo = { text: string };

export const SimpleTodoList = creo<{ text: string; todos: Array<Todo> }>(
  (c) => {
    const todos: Array<Todo> = c.tracked(c.p.todos);
    return {
      render() {
        Inline(_, () => {
          Text(c.p.text);
        });
        Block(_, () => {
          Text("Hello inside container");
          VStack(_, () => {
            TodoList({ todos });
          });
        });
      },
    };
  },
);

export const TodoList = creo<{ todos: Array<Todo> }>((c) => {
  const todos: Array<Todo> = c.tracked(c.p.todos);
  return {
    render() {
      todos.map((todo) => {
        Block({ class: "todo" }, () => {
          Text(`Entity: ${todo.text}`);
        });
      });
    },
  };
});
