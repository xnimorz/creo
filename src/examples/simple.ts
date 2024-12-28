import { record, RecordOf } from "../data-structures/record/Record";
import { Component, creo } from "../ui/Component";
import { Block } from "../ui/css/Block";
import { Text } from "../ui/css/Text";
import { VStack } from "../ui/css/VStack";

type Todo = { text: string };

@creo
class MyComponent extends Component {
  private todos: RecordOf<Array<Todo>> = this.tracked([]);

  ui() {
    Text("Hello world");
    Block().with(() => {
      Text("Hello inside container");
      VStack().with(() => {
        this.todos.map((todo) => Text(`Entity: ${todo.text}`));
      });
    }).style({
      display: 'flex',
      flex: 'content',
    });
  }
}