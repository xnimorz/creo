import { Engine, type Scheduler } from "@/internal/engine";
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
 *   createApp(() => <App/>, new HtmlRender(el)).mount();                    // JSX
 *   createApp(() => App(), new HtmlRender(el), { scheduler: requestAnimationFrame }).mount();
 *
 * The root callback may either emit directly (plain calls) or return a JSX
 * thunk `() => void`. A returned thunk is invoked so JSX can be used at the
 * root without an explicit extra call.
 */
export function createApp(
  slot: () => void | (() => void),
  renderer: IRender<Wildcard>,
  options?: AppOptions,
) {
  return {
    mount(props?: Wildcard): AppHandle {
      const engine = new Engine(renderer, options?.scheduler);
      const wrapped = () => {
        const result = slot();
        if (typeof result === "function") (result as () => void)();
      };
      engine.createRoot(wrapped, props ?? {});
      engine.render();
      return { engine };
    },
  };
}
