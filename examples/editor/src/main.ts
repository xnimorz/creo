import { createApp } from "@/public/app";
import { HtmlRender } from "@/render/html_render";
import { App } from "./app";

createApp(
  () => {
    App();
  },
  new HtmlRender(document.querySelector("#app") as HTMLElement),
).mount();
