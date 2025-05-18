import { SimpleStringEngine } from "./engine/SimpleStringEngine";
import { SimpleTodoList } from "./examples/SimpleTodoList/SimpleTodoList";
import "./style.css";

const engine = new SimpleStringEngine();
console.log(
  engine.render(() => {
    SimpleTodoList({ text: "Hello world" });
  }, null),
);

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;
