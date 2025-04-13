/**
 * String layout for creo
 * Can be used for SSR, unit tests
 *
 *
 */

import { LayoutEngine, c_resetLayoutEngine, c_setLayoutEngine } from "./layoutEngine";

export class StringLayout extends LayoutEngine {
  private str: string;
  constructor() {
    super();
    this.str = ''
  }

  create(ui: () => void): void {
    c_setLayoutEngine(this)
    ui();
    c_resetLayoutEngine();
  }

  refresh(): void {
    // string layout does nothing here ATM
  }
}
