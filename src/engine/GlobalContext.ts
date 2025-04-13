import { Maybe } from "../data-structures/maybe/Maybe";
import { LayoutEngine } from "./LayoutEngine";

// #region LayoutEngine
/**
 * Layout engine control methods:
 *
 * Each rendering cycle we manually set up active layout engine to GlobalContext and perform rendering.
 * There might be only one active running Layout Engine per time
 */
let c_activeEngine: Maybe<LayoutEngine>;

export function getActiveLayoutEngine(): Maybe<LayoutEngine> {
  return c_activeEngine;
}

export function setActiveLayoutEngine(engine: LayoutEngine) {
  c_activeEngine = engine;
}

export function resetLayoutEngine() {
  c_activeEngine = null;
}
// #endregion
