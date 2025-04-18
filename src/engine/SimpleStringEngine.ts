import { Maybe } from "../data-structures/maybe/Maybe";
import { InternalUINode } from "./Node";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";
import { IndexedMap } from "../data-structures/indexed-map/IndexedMap";
import { Key } from "./Key";

export class SimpleStringEngine extends LayoutEngine {
  children: IndexedMap<StringRecord, "key"> = new IndexedMap("key");

  renderNode(node: InternalUINode): LayoutNode {
    const stringRecord = new StringRecord(node.internalKey, node.tag, node.p);
    const layoutNode = new StringLayoutNode(stringRecord);
    (node.parentUI.layoutNode as StringLayoutNode).stringRecord.children.put(
      stringRecord,
    );
    return layoutNode;
  }
}

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
}
