import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import type { IRender } from "@/render/render_interface";
import type { Wildcard } from "@/internal/wildcard";

type AppHandle = {
  engine: Engine;
};

/**
 * Create a Creo application.
 *
 *   createApp(App, new HtmlRender(document.getElementById("app")!)).mount();
 *   createApp(App, new JsonRender()).mount();
 *   createApp(App, new StringRender()).mount();
 */
export function createApp(
  view: (props: Wildcard, slot: () => void) => void,
  renderer: IRender<Wildcard>,
) {
  return {
    mount(props?: Wildcard): AppHandle {
      const engine = new Engine(renderer);
      orchestrator.setCurrentEngine(engine);
      view(props ?? {}, () => {});
      engine.initialRender();
      return { engine };
    },
  };
}
