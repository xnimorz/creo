/**
 *  Represents physical node for UI rendering engine
 *  In charge of:
 *  1. UI changes
 *  2. Animations
 *  3. GC when gets destroyed
 */

import { NodeBuilder, NodeMethods } from "../creo";
import { assertJust } from "../data-structures/assert/assert";
import { IndexedMap } from "../data-structures/indexed-map/IndexedMap";
import { Maybe } from "../data-structures/maybe/Maybe";
import { shallowEqual } from "../data-structures/shalllowEqual/shallowEqual";
import { generateNextKey } from "../data-structures/simpleKey/simpleKey";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { CreoContext } from "./Context";
import { Key } from "./Key";
import { LayoutEngine, LayoutNode } from "./LayoutEngine";

export enum NodeStatus {
  DIRTY,
  UPDATING,
  CLEAR,
}

export enum UpdateDirectiveEnum {
  // Change element position
  MOVE,
  // No component, just create a new
  NEW,
  // Matched component, update existing item
  REUSE,
  // Matched key, but different component
  REPLACE,
}

type UpdateDirective = {
  updateDirective: UpdateDirectiveEnum;
  node: Maybe<InternalNode>;
};

export class InternalNode {
  public publicNode: Node<Wildcard>;
  public c: CreoContext<Wildcard>;
  public depth: number;
  public layout: LayoutEngine;
  public parentIndex: number;
  public status: NodeStatus = NodeStatus.DIRTY;
  public children: IndexedMap<InternalNode, "internalKey"> = new IndexedMap(
    "internalKey",
    ["userKey"],
  );

  public pendingChildrenState!: IndexedMap<InternalNode, "internalKey">;
  public renderCursor: Maybe<InternalNode>;

  public lifecycle: NodeMethods<Wildcard, Wildcard>;
  constructor(
    public userKey: Maybe<Key>,
    public internalKey: Key,
    public p: Wildcard,
    public slot: Maybe<() => void>,
    public ctor: NodeBuilder<Wildcard, Wildcard>,
    public parent: InternalNode,
    public parentUI: InternalUINode,
  ) {
    this.c = new CreoContext(this, p, slot);
    this.layout = parent.layout;
    this.parentIndex = parent.pendingChildrenState.size();
    this.depth = (parent.depth ?? 0) + 1;
    this.layout.registy.put(this);
    const { extension, ...lifecycle } = this.ctor(this.c);
    this.lifecycle = lifecycle;
    this.publicNode = new Node(extension);
  }

  // sets status to dirty for the node
  invalidate() {
    if (this.status !== NodeStatus.CLEAR) {
      return;
    }

    // TODO make updateIndex be observable
    this.status = NodeStatus.DIRTY;
    this.layout.registy.updateIndex(this);
  }

  moveNode() {
    this.invalidate();
  }

  applyNewParams(newParams: Wildcard) {
    if (this.shouldUpdate(newParams)) {
      this.invalidate();
    }
    this.c.p = newParams;
  }

  willRender() {
    this.pendingChildrenState = new IndexedMap("internalKey", ["userKey"]);
    this.renderCursor = this.children.at(0);
    this.status = NodeStatus.UPDATING;
    this.layout.registy.updateIndex(this);
    this.layout.willRender(this);
  }

  didRender() {
    // When the rendering cycle ends, all items starting
    // from this.renderingCursor were not used and hence, need to be deleted
    while (this.renderCursor != null) {
      this.renderCursor.dispose();
      this.renderCursor = this.children.getNext(this.renderCursor);
    }
    // At the end of the cycle, we replace children with pending children (this.renderingChildren)
    this.children = this.pendingChildrenState;
    this.pendingChildrenState = new IndexedMap("internalKey", ["userKey"]);

    // Before completing the render of parent, we want to ensure children are updated
    // TODO child should be rendered immediately, not later
    for (const node of this.children) {
      if (node.status === NodeStatus.DIRTY) {
        node.render();
      }
    }
    this.status = NodeStatus.CLEAR;
    this.layout.registy.updateIndex(this);

    this.layout.didRender(this);
  }

  render() {
    this.willRender();
    __DEV__ && console.log("re-render:", this.internalKey);
    this.lifecycle.render();
    this.didRender();
  }

  didMount(): void {
    this.lifecycle.didMount?.();
  }

  didUpdate(): void {
    this.lifecycle.didUpdate?.();
  }

  shouldUpdate(pendingParams: Wildcard): boolean {
    if (this.lifecycle.shouldUpdate != null) {
      return this.lifecycle.shouldUpdate(pendingParams);
    }
    return !shallowEqual(this.c.p, pendingParams);
  }

  generateUpdateDirective(
    userKey: Maybe<Key>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    tag: Maybe<string>,
  ): UpdateDirective {
    const expectedChild: Maybe<InternalNode> = this.renderCursor;
    let expectedTag: Maybe<string> = null;
    if (expectedChild instanceof InternalUINode) {
      tag = expectedChild.tag;
    }
    if (
      expectedChild != null &&
      expectedChild.ctor === ctor &&
      expectedTag == tag &&
      // TODO: We should respect & identify artificially generated keys too
      (userKey == null || userKey === expectedChild.userKey)
    ) {
      return {
        updateDirective: UpdateDirectiveEnum.REUSE,
        node: expectedChild,
      };
    }

    // TODO support "unique" indexes + respect nulls
    // Unhappy path exploration.
    const maybeKeyedMatchedChildren: InternalNode[] =
      userKey != null ? this.children.getByIndex("userKey", userKey) : [];

    if (maybeKeyedMatchedChildren.length > 1) {
      throw new Error("Spotted duplicate keys for the node");
    }
    const maybeKeyedMatchedChild: Maybe<InternalNode> =
      maybeKeyedMatchedChildren[0];

    // Case 1: Key, no next component, but matched key: something went wrong
    if (
      expectedChild == null &&
      userKey != null &&
      maybeKeyedMatchedChild != null
    ) {
      throw new Error(`Detected key duplication: ${userKey}`);
    }

    // Case 2: Key, matched key, not matched next element
    if (
      expectedChild != null &&
      userKey != null &&
      maybeKeyedMatchedChild != null
    ) {
      // We have matched key, but their constructors are different
      // In theory that process is REPLACE, but for external usages, it works exactly the same way as NEW
      // The difference is purely internal
      if (maybeKeyedMatchedChild.ctor !== ctor || expectedTag != tag) {
        return {
          updateDirective: UpdateDirectiveEnum.REPLACE,
          node: maybeKeyedMatchedChild,
        };
      }
      // TODO detect potential key duplication?
      // Everything is fine, we just need to move that item to different place
      return {
        updateDirective: UpdateDirectiveEnum.MOVE,
        node: maybeKeyedMatchedChild,
      };
    }

    // Default outcome: Component creation
    // Cases:
    // 1. No key, component mismatch or no component
    // 2. Key, no next component, no matched key
    return {
      updateDirective: UpdateDirectiveEnum.NEW,
      node: null,
    };
  }

  renderChild(
    userKey: Maybe<Key>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    params: Maybe<Wildcard>,
    slot: Maybe<() => void>,
    tag: Maybe<string>,
  ): InternalNode {
    const directive = this.generateUpdateDirective(userKey, ctor, tag);

    let newNode: InternalNode;

    switch (directive.updateDirective) {
      case UpdateDirectiveEnum.REUSE: {
        // TODO: MAYBE update SLOT
        assertJust(directive.node, "Cannot re-use null node");
        newNode = directive.node;
        this.pendingChildrenState.put(newNode);
        this.renderCursor =
          this.renderCursor != null
            ? this.children.getNext(this.renderCursor)
            : null;
        this.children.delete(newNode.internalKey);
        // The component can decide on its own if the component needs to get updated
        directive.node.applyNewParams(params);
        break;
      }
      case UpdateDirectiveEnum.MOVE: {
        // TODO: move all DOM children which are connected to the top-level
        throw new Error("Not implemented");
      }
      case UpdateDirectiveEnum.NEW: {
        newNode = this.createNewNode(userKey, ctor, params, slot, tag);
        break;
      }
      case UpdateDirectiveEnum.REPLACE: {
        assertJust(directive.node, "Cannot replace null component");
        const toReplace = directive.node;
        if (this.renderCursor === toReplace) {
          this.renderCursor = this.children.getNext(this.renderCursor);
        }
        // Delete conflicting element, as they should not exist anymore
        this.children.delete(toReplace.internalKey);
        // Cleanup the component:
        toReplace.dispose();
        newNode = this.createNewNode(userKey, ctor, params, slot, tag);
        break;
      }
    }
    if (newNode.status === NodeStatus.DIRTY) {
      newNode.render();
    }
    return newNode;
  }

  protected createNewNode(
    userKey: Maybe<Key>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    params: Maybe<Wildcard>,
    slot: Maybe<() => void>,
    tag: Maybe<string>,
  ): InternalNode {
    let node: InternalNode;
    if (tag == null) {
      node = new InternalNode(
        userKey,
        this.generateKey(),
        params,
        slot,
        ctor,
        this,
        this.parentUI,
      );
    } else {
      node = new InternalUINode(
        userKey,
        this.generateKey(),
        params,
        slot,
        ctor,
        this,
        this.parentUI,
        tag,
      );
    }

    this.pendingChildrenState.put(node);
    this.layout.registy.put(node);
    return node;
  }

  protected generateKey(): Key {
    return `c:${generateNextKey()}:${this.children.size()}`;
  }

  dispose(): void {
    // delete any DOM / whatever nodes we have
    // Propagate removal of data to all children

    // Remove subscriptions
    this.c.dispose();

    // Parent component should alredy not to have children, but we can have sanity check there

    // Mark component as not dirty, as there is no point in keeping that item anymore
    this.layout.registy.delete(this.internalKey);
  }
}

export class InternalUINode extends InternalNode {
  public uiChildren: IndexedMap<InternalUINode, "internalKey"> = new IndexedMap(
    "internalKey",
    ["userKey"],
  );
  public pendingUIChildrenState!: IndexedMap<InternalUINode, "internalKey">;
  public layoutNode: Maybe<LayoutNode>;
  constructor(
    userKey: Maybe<Key>,
    internalKey: Key,
    p: Wildcard,
    slot: Maybe<() => void>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    parent: InternalNode,
    parentUI: InternalUINode,
    public tag: string,
  ) {
    super(userKey, internalKey, p, slot, ctor, parent, parentUI);
    // Root element does not have parentUI
    if (this.parentUI) {
      this.parentUI.uiChildren.put(this);
    }
  }

  protected createNewNode(
    userKey: Maybe<Key>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    params: Maybe<Wildcard>,
    slot: Maybe<() => void>,
    tag: Maybe<string>,
  ): InternalNode {
    let node: InternalNode;
    if (tag == null) {
      node = new InternalNode(
        userKey,
        this.generateKey(),
        params,
        slot,
        ctor,
        this,
        this,
      );
    } else {
      node = new InternalUINode(
        userKey,
        this.generateKey(),
        params,
        slot,
        ctor,
        this,
        this,
        tag,
      );
    }

    this.pendingChildrenState.put(node);
    this.layout.registy.put(node);
    return node;
  }

  render() {
    this.willRender();
    __DEV__ && console.log("UI re-render:", this.internalKey);
    this.layoutNode = this.layout.renderNode(this);
    this.lifecycle.render();
    this.didRender();
  }

  dispose(): void {
    super.dispose();
    this.layoutNode?.dispose();
  }
}

export class Node<A> {
  constructor(public extension: A extends void ? undefined : A) {}
}
