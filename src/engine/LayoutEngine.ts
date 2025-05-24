/**
 * Layout engine abstract class
 *
 *
 * Ideas:
 * [ ] HTML layout engine, that re-uses existing HTML&CSS
 * [ ] Canvas layout engine
 * [ ] String layout engine
 * [ ] Event systems
 * [ ] Animation engine
 * [ ] Layout engines should work with CreoTree
 */

import { IndexedMap } from "../data-structures/indexed-map/IndexedMap";
import { List } from "../data-structures/list/List";
import { Maybe } from "../data-structures/maybe/Maybe";
import { resetLayoutEngine, setActiveLayoutEngine } from "./GlobalContext";
import { InternalNode, InternalUINode, NodeStatus } from "./Node";

export abstract class LayoutEngine {
  protected isRerenderingScheduled = true;
  // Queue of currently rendering items
  renderingQueue: List<InternalNode> = List();

  registy: IndexedMap<InternalNode, "internalKey"> = new IndexedMap(
    "internalKey",
    ["status"],
  );

  constructor() {
    this.registy.subscribeToIndexChange("status", (value) => {
      if (value === NodeStatus.DIRTY && this.isRerenderingScheduled === false) {
        this.scheduleRerender();
      }
    });
  }

  debugStatus() {
    console.log(this.registy);
  }

  getCurrentlyRenderingNode(): Maybe<InternalNode> {
    return this.renderingQueue.at(-1)?.value;
  }

  willRender(node: InternalNode) {
    this.renderingQueue.addToEnd(node);
  }

  didRender(node: InternalNode) {
    const maybeNode = this.renderingQueue.at(-1)?.node;
    if (maybeNode !== node) {
      throw new Error(
        "Cannot close component rendering due to component mismatch",
      );
    }
    this.renderingQueue.delete(-1);
    this.renderNextPending();
  }

  // Add params to support data insertion in middle
  abstract renderNode(node: InternalUINode): LayoutNode;

  abstract render(renderFn: () => void): void;
  abstract forceRerender(): void;
  abstract scheduleRerender(): void;

  protected renderNextPending() {
    const next = this.registy.getByIndex("status", NodeStatus.DIRTY)[0];
    if (next != null) {
      next.render();
    }
  }

  rerender() {
    setActiveLayoutEngine(this);
    console.log("rerender");
    this.renderNextPending();
    resetLayoutEngine();
    this.isRerenderingScheduled = false;
  }
}

export abstract class LayoutNode {
  public abstract node: InternalUINode;
  abstract render(): unknown;
  abstract dispose(): void;
}
