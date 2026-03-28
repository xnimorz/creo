import { Engine, type Scheduler } from "@/internal/engine";
import { View } from "@/internal/internal_view";
import { orchestrator } from "@/internal/orchestrator";
import type { IRender } from "@/render/render_interface";
import type { Wildcard } from "@/internal/wildcard";

type AppOptions = {
  scheduler?: Scheduler;
};

type AppHandle = {
  engine: Engine;
};

/**
 * Create a Creo application.
 *
 *   createApp(() => App(), new HtmlRender(el)).mount();
 *   createApp(() => App(), new HtmlRender(el), { scheduler: requestAnimationFrame }).mount();
 */
export function createApp(
  slot: () => void,
  renderer: IRender<Wildcard>,
  options?: AppOptions,
) {
  return {
    mount(props?: Wildcard): AppHandle {
      const engine = new Engine(renderer, options?.scheduler);
      orchestrator.setCurrentEngine(engine);
      new View(
        () => ({ render() { slot(); } }),
        props ?? {},
        null,
        engine,
        null,
        null,
      );
      engine.render();
      return { engine };
    },
  };
}
