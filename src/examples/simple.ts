import { RecordOf } from "../data-structures/record/Record";
import { creo } from "../old/ui/Component";
import { Block } from "../old/ui/css/Block";
import { Text } from "../old/ui/css/Text";
import { VStack } from "../old/ui/css/VStack";

type Todo = { text: string };

const MyComponent2 = creo((p: { text: string }, c) => {
  const todos: Array<Todo> = c.tracked([]);

  return {
    ui() {
      Text(p.text);
      Block()
        .with(() => {
          Text("Hello inside container");
          VStack().with(() => {
            todos.map((todo) => Text(`Entity: ${todo.text}`));
          });
        })
        .style({
          display: "flex",
          flex: "content",
        });
    },
  };
});
