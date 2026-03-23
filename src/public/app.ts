import { Engine } from "@/internal/engine";
import { orchestrator } from "@/internal/orchestrator";
import { HtmlRender } from "@/render/html_render";
import type { IRender } from "@/render/render_interface";
import type { Wildcard } from "@/internal/wildcard";

type AppHandle = {
  engine: Engine;
};

type AppOptions = {
  renderer?: IRender<Wildcard>;
};

/**
 * Create a Creo application.
 *
 *   createApp(App).mount("#app");
 *   createApp(App, { renderer: new JsonRender() }).mount();
 */
export function createApp(
  view: (props: Wildcard, slot: () => void) => void,
  options?: AppOptions,
) {
  return {
    mount(target?: string | HTMLElement, props?: Wildcard): AppHandle {
      const renderer =
        options?.renderer ?? new HtmlRender(resolveElement(target));
      const engine = new Engine(renderer);
      orchestrator.setCurrentEngine(engine);
      view(props ?? {}, () => {});
      engine.initialRender();
      return { engine };
    },
  };
}

function resolveElement(target?: string | HTMLElement): HTMLElement {
  if (target instanceof HTMLElement) return target;
  const el = document.querySelector(target ?? "#app");
  if (!el)
    throw new Error(`Creo: mount target "${target ?? "#app"}" not found`);
  return el as HTMLElement;
}
