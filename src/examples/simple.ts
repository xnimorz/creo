import { creo } from "../creo";
import { Block } from "../old/ui/css/Block";
import { Text } from "../old/ui/css/Text";
import { VStack } from "../old/ui/css/VStack";

type Todo = { text: string };

const MyTodoList = creo<{ text: string }>((c) => {
  const todos: Array<Todo> = c.tracked([]);

  return {
    render() {
      Text(c.p.text);
      Block().with(() => {
        Text("Hello inside container");
        VStack().with(() => {
          todos.map((todo) => Text(`Entity: ${todo.text}`));
        });
      });
    },
  };
});
