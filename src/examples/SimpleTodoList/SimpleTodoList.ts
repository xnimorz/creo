import { creo } from "../../creo";
import { Block } from "../../ui/html/Block";
import { Inline } from "../../ui/html/Inline";
import { Text } from "../../ui/html/Text";
import { VStack } from "../../ui/html/VStack";
import { _ } from "../../data-structures/null/null";

type Todo = { text: string };

export const SimpleTodoList = creo<{ text: string }>((c) => {
  const todos: Array<Todo> = c.tracked([]);

  return {
    render() {
      Inline(_, () => {
        Text(c.p.text);
      });
      Block(_, () => {
        Text("Hello inside container");
        VStack(_, () => {
          todos.map((todo) => Text(`Entity: ${todo.text}`));
        });
      });
    },
  };
});
