import { Block, Button, creo, Inline, Text } from "../../creo";
import { Maybe } from "../../data-structures/maybe/Maybe";
import { _ } from "../../data-structures/null/null";

type Todo = { text: string };

export const SimpleTodoList = creo<{ text: string; todos: Array<Todo> }>(
  (c) => {
    const todos: Array<Todo> = c.tracked(c.p.todos);
    let button: () => Maybe<HTMLElement>;
    return {
      didMount() {
        console.warn("did mount");
        console.log(button());
        button()?.addEventListener("click", () => {
          todos.push({ text: `Task #${todos.length}` });
        });
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
          Block(_, () => {
            TodoList({ todos });
          });
        });
        button = Button(_, () => Text("Add todo"));
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
        console.log(todo);
        Block({ class: "todo" }, () => {
          console.log(`Entity: ${todo.text}`);
          Text(`Entity: ${todo.text}`);
        });
      });
    },
  };
});
