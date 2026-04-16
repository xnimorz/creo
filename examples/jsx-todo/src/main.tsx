import { createApp, HtmlRender } from "creo";
import { App } from "./app";

createApp(
  () => <App />,
  new HtmlRender(document.querySelector("#app") as HTMLElement),
).mount();
