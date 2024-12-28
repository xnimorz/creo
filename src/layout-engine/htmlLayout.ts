/**
 * HTML layout for creo
 *
 *
 * Ideas:
 * [ ] Re-uses existing HTML&CSS
 */

import { LayoutEngine } from "./layoutEngine";

export class HtmlLayout extends LayoutEngine {
  private rootHtml: HTMLElement;
  constructor(root: HTMLElement) {
    super();
    this.rootHtml = root;
  }
}
