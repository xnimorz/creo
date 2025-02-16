import { RecordOf } from "../data-structures/record/Record";
import { creo } from "../ui/Component";
import { Block } from "../ui/css/Block";
import { Text } from "../ui/css/Text";
import { VStack } from "../ui/css/VStack";

type Todo = { text: string };

const MyComponent2 = creo((p: {text: string}, c) => {
  const todos: Array<Todo> = c.tracked([]);

  return {
    ui() {
      Text(p.text);
      Block().with(() => {
        Text("Hello inside container");
        VStack().with(() => {
          todos.map((todo) => Text(`Entity: ${todo.text}`));
        });
      }).style({
        display: 'flex',
        flex: 'content',
      });
    }
  }  
});