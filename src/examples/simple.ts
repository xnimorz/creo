import { creo } from "../creo";
import { Block } from "../ui/html/Block";
import { Inline } from "../ui/html/Inline";
import { Text } from "../ui/html/Text";
import { VStack } from "../ui/html/VStack";

type Todo = { text: string };

const MyTodoList = creo<{ text: string }>((c) => {
  const todos: Array<Todo> = c.tracked([]);

  return {
    render() {
      Inline().with(() => {
        Text(c.p.text);
      });
      Block().with(() => {
        Text("Hello inside container");
        VStack().with(() => {
          todos.map((todo) => Text(`Entity: ${todo.text}`));
        });
      });
    },
  };
});
