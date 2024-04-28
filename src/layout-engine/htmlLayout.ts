import { LayoutEngine } from "./layoutEngine";

export class HtmlLayout extends LayoutEngine {
  private rootHtml: HTMLElement;
  constructor(root: HTMLElement) {
    super();
    this.rootHtml = root;
  }
}
