import { Maybe } from "../data-structures/maybe/Maybe";
import { InternalUINode } from "./Node";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";
import { IndexedMap } from "../data-structures/indexed-map/IndexedMap";
import { Key } from "./Key";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { resetLayoutEngine, setActiveLayoutEngine } from "./GlobalContext";

export class SimpleStringEngine extends LayoutEngine {
  children: IndexedMap<StringRecord, "key"> = new IndexedMap("key");

  renderNode(node: InternalUINode): LayoutNode {
    if (node.tag === "root") {
      const stringRecord = new StringRecord(node.internalKey, node.tag, node.p);
      const layoutNode = new StringLayoutNode(stringRecord);
      this.children.put(stringRecord);
      return layoutNode;
    }
    const stringRecord = new StringRecord(node.internalKey, node.tag, node.p);
    const layoutNode = new StringLayoutNode(stringRecord);
    (node.parentUI.layoutNode as StringLayoutNode).stringRecord.children.put(
      stringRecord,
    );
    return layoutNode;
  }

  render(renderFn: () => void, _root: unknown): string {
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
    const result = [];
    for (const stringRecord of this.children) {
      result.push(stringRecord.render());
    }
    resetLayoutEngine();
    return JSON.stringify(result, null, "  ");
  }
}

type RenderResult = { tag: string; params: Wildcard; children: RenderResult[] };

class StringLayoutNode extends LayoutNode {
  constructor(public stringRecord: StringRecord) {
    super();
  }
}

class StringRecord {
  children: IndexedMap<StringRecord, "key"> = new IndexedMap("key");

  constructor(
    public key: Key,
    public tag: string,
    public params: Maybe<{ [key: string]: string }>,
  ) {}

  render(): RenderResult {
    const record: RenderResult = {
      tag: this.tag,
      params: this.params,
      children: [],
    };
    for (const stringRecord of this.children) {
      record.children.push(stringRecord.render());
    }

    return record;
  }
}
