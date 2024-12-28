/**
 * String layout for creo
 * Can be used for SSR, unit tests
 *
 *
 */

import { LayoutEngine } from "./layoutEngine";

export class StringLayout extends LayoutEngine {
  private str: string;
  constructor() {
    super();
    this.str = ''
  }
}
