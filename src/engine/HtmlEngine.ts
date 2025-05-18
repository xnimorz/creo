import { InternalNode, InternalUINode } from "./Node";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { resetLayoutEngine, setActiveLayoutEngine } from "./GlobalContext";
import { Maybe } from "../data-structures/maybe/Maybe";

export class HtmlEngine extends LayoutEngine {
  public root: HTMLElement;
  renderNode(node: InternalUINode): LayoutNode {
    if (node.layoutNode == null) {
      if (node.tag === "creo") {
        const layoutNode = new RootHtmlNode(this.root);
        return layoutNode;
      }
      const layoutNode = new HtmlNode(node);
      return layoutNode;
    }
    // re-use & re-render
    this.renderLayoutNode(node, layoutNode) {
      LayoutNode.re
    }
  }

  renderLayoutNode(node: InternalUINode, layoutNode: HtmlNode) {

  }

  render(renderFn: () => void, htmlNode: HTMLElement): void {
    this.root = htmlNode;
    setActiveLayoutEngine(this);
    const rootNode = new InternalUINode(
      "creo",
      "creo",
      null,
      renderFn,
      (c) => ({
        render() {
          c.slot?.();
        },
      }),
      {
        layout: this,
        // @ts-ignore
        pendingChildrenState: {
          size: () => 0,
        },
      },
      null,
      "root",
    );
    rootNode.render();
    resetLayoutEngine();
  }
}

class HtmlNode extends LayoutNode {
  public element: HTMLElement | Text;
  public isMounted: boolean;
  constructor(public node: InternalUINode) {
    super();
    this.isMounted = false;
    if (node.tag === "text" && typeof node.p === "string") {
      this.element = document.createTextNode(node.p);
    } else {
      this.element = document.createElement(node.tag);
    }
  }

  render() {
    if (!this.isMounted) {
      (this.node.parentUI?.layoutNode as HtmlNode)?.element?.appendChild(this.element)
      this.isMounted = true;
    }

  }
}

class RootHtmlNode extends LayoutNode {
  constructor(public element: HTMLElement) {
    super();
  }

  render() {

  }
}
