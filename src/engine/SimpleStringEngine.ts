import { InternalUINode } from "./Node";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";
import { IndexedMap } from "../data-structures/indexed-map/IndexedMap";
import { Key } from "./Key";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { resetLayoutEngine, setActiveLayoutEngine } from "./GlobalContext";
import { Maybe } from "../data-structures/maybe/Maybe";

export class SimpleStringEngine extends LayoutEngine {
  children: IndexedMap<StringLayoutNode, "key"> = new IndexedMap("key");

  state: string = "";
  rootNode: Maybe<InternalUINode>;

  renderNode(node: InternalUINode): LayoutNode {
    if (node.tag === "root") {
      const layoutNode = new StringLayoutNode(node);
      this.children.put(layoutNode);
      return layoutNode;
    }
    const layoutNode = new StringLayoutNode(node);
    // (node.parentUI.layoutNode as StringLayoutNode).stringRecord.children.put(
    //   stringRecord,
    // );
    return layoutNode;
  }

  renderResult(): string {
    return this.state;
  }
  forceRerender(): void {
    if (!this.rootNode) {
      return;
    }
    setActiveLayoutEngine(this);
    console.log("forcererender");
    this.rootNode.render();
    resetLayoutEngine();
  }
  render(renderFn: () => void): void {
    setActiveLayoutEngine(this);
    const rootNode = new InternalUINode(
      "root",
      "root",
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
    this.rootNode = rootNode;
    const result = [];
    for (const stringRecord of this.children) {
      result.push(stringRecord.render());
    }
    resetLayoutEngine();
    this.state = JSON.stringify(result, null, "  ");
  }
}

type RenderResult = { tag: string; params: Wildcard; children: RenderResult[] };

class StringLayoutNode extends LayoutNode {
  public key: Key;
  constructor(public node: InternalUINode) {
    super();
    this.key = this.node.internalKey;
  }
  render(): RenderResult {
    const record: RenderResult = {
      tag: this.node.tag,
      params: this.node.p,
      children: [],
    };
    for (const node of this.node.uiChildren) {
      if (node.layoutNode) {
        record.children.push((node.layoutNode as StringLayoutNode).render());
      }
    }

    return record;
  }

  dispose() {
    throw new Error("not supported");
  }
}
