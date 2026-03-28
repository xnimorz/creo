import { createApp } from "@/public/app";
import { HtmlRender } from "@/render/html_render";
import { App } from "./app";

const { engine } = createApp(
  () => App(),
  new HtmlRender(document.querySelector("#app")!),
).mount();

// -- Render timing: captures click-to-render-complete for every interaction --

let clickT0 = 0;
let clickLabel = "";

document.addEventListener(
  "click",
  (e) => {
    const el = (e.target as HTMLElement).closest("[id]");
    clickLabel = el?.id || "click";
    clickT0 = performance.now();
  },
  true, // capture phase — fires before framework handlers
);

const origRenderLoop = engine.render.bind(engine);
engine.render = function () {
  const renderT0 = performance.now();
  origRenderLoop();
  const renderMs = performance.now() - renderT0;

  if (clickT0) {
    const totalMs = performance.now() - clickT0;
    console.log(
      `%c${clickLabel}%c ${totalMs.toFixed(1)}ms total, ${renderMs.toFixed(1)}ms render`,
      "font-weight:bold",
      "",
    );
    clickT0 = 0;
  }
};
