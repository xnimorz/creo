import { InternalUINode } from "./Node";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";
import { resetLayoutEngine, setActiveLayoutEngine } from "./GlobalContext";
import { Maybe } from "../data-structures/maybe/Maybe";

export class HtmlEngine extends LayoutEngine {
  rootNode: Maybe<InternalUINode>;
  constructor(public root: HTMLElement) {
    super();
  }
  renderNode(node: InternalUINode): LayoutNode {
    if (node.layoutNode == null) {
      let layoutNode;
      if (node.tag === "creo") {
        layoutNode = new RootHtmlNode(node, this.root);
      } else {
        layoutNode = new HtmlNode(node);
      }
      node.layoutNode = layoutNode;
    }
    node.layoutNode.render();
    return node.layoutNode;
  }

  forceRerender() {
    if (this.rootNode != null) {
      setActiveLayoutEngine(this);
      console.log("forcererender");
      this.rootNode.render();
      resetLayoutEngine();
      return;
    }
  }
  render(renderFn: () => void): void {
    // Force re-render
    if (this.rootNode != null) {
      return this.forceRerender();
    }
    // New node
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
      "creo",
    );
    rootNode.render();
    this.rootNode = rootNode;
    resetLayoutEngine();
    console.log(rootNode);
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
      (this.node.parentUI?.layoutNode as HtmlNode)?.element?.appendChild(
        this.element,
      );
      this.isMounted = true;
    }

    const params = this.node.p;
    const element = this.element;
    if (element instanceof Text && typeof params === "string") {
      element.textContent = params;
    }
    if (element instanceof HTMLElement && typeof params === "object") {
      for (const key in params) {
        if (element.getAttribute(key) !== params[key]) {
          element.setAttribute(key, params[key]);
        }
      }
    }
    __DEV__ && element?.setAttribute?.("creo-debug", this.node.internalKey);
  }

  dispose() {
    this.element.parentNode?.removeChild(this.element);
    // TODO delete event listeners if any
  }
}

class RootHtmlNode extends LayoutNode {
  constructor(
    public node: InternalUINode,
    public element: HTMLElement,
  ) {
    super();
  }

  render() {}

  dispose() {}
}
