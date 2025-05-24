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
import { InternalNode, InternalUINode } from "./Node";

export abstract class LayoutEngine {
  // Queue of currently rendering items
  renderingQueue: List<InternalNode> = List();

  registy: IndexedMap<InternalNode, "internalKey"> = new IndexedMap(
    "internalKey",
    ["userKey", "status"],
  );

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
  }

  // Add params to support data insertion in middle
  abstract renderNode(node: InternalUINode): LayoutNode;

  abstract render(renderFn: () => void): void;
  abstract forceRerender(): void;
}

export abstract class LayoutNode {
  public abstract node: InternalUINode;
  abstract render(): unknown;
  abstract dispose(): void;
}
