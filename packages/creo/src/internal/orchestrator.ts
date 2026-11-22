import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

/** Tracks the active engine (an app may run several). */
class Orchestrator {
  #currentEngine: Maybe<Engine>;

  setCurrentEngine(engine: Maybe<Engine>) {
    this.#currentEngine = engine;
  }

  public currentEngine(): Maybe<Engine> {
    return this.#currentEngine;
  }
}

export const orchestrator = new Orchestrator();
