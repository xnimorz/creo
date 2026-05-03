import { createApp, HtmlRender } from "creo";
import { App, editor } from "./app";

// Expose the editor handle so Playwright tests can drive it directly.
(window as unknown as { __editor: typeof editor }).__editor = editor;

createApp(
  () => {
    App();
  },
  new HtmlRender(document.querySelector("#app") as HTMLElement),
).mount();
