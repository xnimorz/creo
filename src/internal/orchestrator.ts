import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

/**
 * Orchestrator is the high-level class, that handles the oveall operations for the UI engine
 *  1. When View is rendered or updated, orchestrator is responsible of bringing the renderer, virtual dom and engine together
 *  2. Keeps track on current views / stores in the app
 *  3. Keeps track on which views need to be updated, which onces are in updating process
 *  4. Sets the current orchestrator scope (e.g. if the app has several Creo renderers)
 */
class Orchestrator {
  #current_engine: Maybe<Engine>;

  set_current_engine(engine: Engine) {
    this.#current_engine = engine;
  }

  public current_engine(): Maybe<Engine> {
    return this.#current_engine;
  }
}

export const orchestrator = new Orchestrator();
