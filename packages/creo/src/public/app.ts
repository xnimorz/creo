import { Engine, type Scheduler } from "@/internal/engine";
import type { IRender } from "@/render/render_interface";
import type { Wildcard } from "@/internal/wildcard";

type AppOptions = {
  scheduler?: Scheduler;
};

type AppHandle = {
  engine: Engine;
};

/** createApp(() => App(), new HtmlRender(el), { scheduler? }).mount() */
export function createApp(
  slot: () => void,
  renderer: IRender<Wildcard>,
  options?: AppOptions,
) {
  return {
    mount(props?: Wildcard): AppHandle {
      const engine = new Engine(renderer, options?.scheduler);
      engine.createRoot(slot, props ?? {});
      engine.render();
      return { engine };
    },
  };
}
