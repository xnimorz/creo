/**
 * Layout engine abstract class
 *
 *
 * Ideas:
 * [ ] Event systems
 * [ ] Animation engine
 */
import { Maybe } from "../data-structures/maybe/Maybe";
import { IRenderCycle } from "./IRenderCycle";
import { Node, RootNode } from "./Node";
import { Registry } from "./Registry";

let $activeEngine: Maybe<DomEngine>;

export class DomEngine implements IRenderCycle {
  protected isRerenderingScheduled = true;
  // Queue of currently rendering items
  protected registry: Registry = new Registry();
  protected root!: RootNode;
  protected rootHtml: HTMLElement;

  constructor(root: HTMLElement) {
    this.rootHtml = root;
  }

  public newNode(node: Node) {
    this.registry.newNode(node);
  }

  public willRender(node: Node) {
    this.registry.willRender(node);
    this.scheduleRerender();
  }

  public isRendering(node: Node) {
    this.registry.isRendering(node);
  }

  public didRender(node: Node): { justMounted: boolean } {
    const result = this.registry.didRender(node);
    return result;
  }

  public dispose(node: Node) {
    this.registry.dispose(node);
  }

  debugStatus() {
    console.log(this.registry);
  }

  render(renderFn: () => void): void {
    if (this.root != null) {
      return this.forceRerender();
    }
    this.root = new RootNode(this.rootHtml, renderFn, this);
    this.forceRerender();
  }

  forceRerender(): void {
    if (this.root == null) {
      return;
    }
    console.log("forcererender");
    this.willRender(this.root);
    this.rerender();
  }

  scheduleRerender(): void {
    if (this.isRerenderingScheduled) {
      return;
    }
    this.isRerenderingScheduled = true;
    globalThis.requestAnimationFrame(() => {
      this.rerender();
    });
  }

  protected renderNextPending() {
    this.isRerenderingScheduled = false;
    const next = this.registry.getNextToRender();
    if (next != null) {
      next.render();
    }
  }

  getParent(): Maybe<Node> {
    return this.registry.getNextRendering();
  }

  rerender() {
    $activeEngine = this;
    this.renderNextPending();
    $activeEngine = null;
  }

  shouldUpdateNode(node: Node): boolean {
    return this.registry.shouldUpdateNode(node);
  }
}

// TODO enhance with other engines, use DOMEngine for now
export function getActiveEngine(): Maybe<DomEngine> {
  return $activeEngine;
}
