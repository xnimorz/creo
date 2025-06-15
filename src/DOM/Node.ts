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
import { Context } from "./Context";
import { DomEngine } from "./DomEngine";
import { IRenderCycle } from "./IRenderCycle";
import { Key } from "./Key";

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
  node: Maybe<Node>;
};

export class Node implements IRenderCycle {
  public publicApi;
  public c: Context<Wildcard>;

  public children: IndexedMap<Node, "key"> = new IndexedMap("key");
  public pendingChildrenState!: IndexedMap<Node, "key">;
  public renderCursor: Maybe<Node>;

  public lifecycle: NodeMethods<Wildcard, Wildcard>;

  constructor(
    public userKey: Maybe<Key>,
    public key: Key,
    public p: Wildcard,
    public slot: Maybe<() => void>,
    public ctor: NodeBuilder<Wildcard, Wildcard>,
    public parent: Node,
    public parentUI: UINode,
    public engine: DomEngine,
  ) {
    this.c = new Context(this, p, slot);
    const { ext, ...lifecycle } = this.ctor(this.c);
    this.lifecycle = lifecycle;
    this.publicApi = ext; //new Node(extension, this);
    this.newNode(this);
  }

  newNode(_node: Node): void {
    this.engine.newNode(this);
  }

  // sets status to dirty for the node
  invalidate() {
    this.willRender();
  }

  applyNewParams(newParams: Wildcard) {
    if (this.shouldUpdate(newParams)) {
      this.willRender();
    }
    this.c.p = newParams;
  }

  willRender() {
    this.engine.willRender(this);
  }

  isRendering() {
    this.engine.isRendering(this);
    this.pendingChildrenState = new IndexedMap("key", ["userKey"]);
    this.renderCursor = this.children.at(0);
  }

  didRender(): { justMounted: boolean } {
    // When the rendering cycle ends, all items starting
    // from this.renderingCursor were not used and hence, need to be deleted
    while (this.renderCursor != null) {
      this.renderCursor.dispose();
      this.renderCursor = this.children.getNext(this.renderCursor);
    }
    // At the end of the cycle, we replace children with pending children (this.renderingChildren)
    this.children = this.pendingChildrenState;
    this.pendingChildrenState = new IndexedMap("key");
    return this.engine.didRender(this);
  }

  render() {
    __DEV__ && console.log("Render:", this.key);
    this.isRendering();
    this.lifecycle.render();
    const { justMounted } = this.didRender();
    if (justMounted) {
      this.lifecycle.didMount?.();
    }
    {
      this.lifecycle.didUpdate?.();
    }
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
    const expectedChild: Maybe<Node> = this.renderCursor;
    let expectedTag: Maybe<string> = null;
    if (expectedChild instanceof UINode) {
      expectedTag = expectedChild.tag;
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

    // Unhappy path exploration.
    const maybeKeyedMatchedChildren: Node[] =
      userKey != null ? this.children.getByIndex("userKey", userKey) : [];

    if (maybeKeyedMatchedChildren.length > 1) {
      throw new Error("Spotted duplicate keys for the node");
    }
    const maybeKeyedMatchedChild: Maybe<Node> = maybeKeyedMatchedChildren[0];

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
  ): Node {
    const directive = this.generateUpdateDirective(userKey, ctor, tag);

    let newNode: Node;

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
        this.children.delete(newNode.key);
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
        this.children.delete(toReplace.key);
        // Cleanup the component:
        toReplace.dispose();
        newNode = this.createNewNode(userKey, ctor, params, slot, tag);
        break;
      }
    }
    if (this.engine.shouldUpdateNode(newNode)) {
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
  ): Node {
    let node: Node;
    if (tag == null) {
      node = new Node(
        userKey,
        generateNextKey(this.pendingChildrenState.size()),
        params,
        slot,
        ctor,
        this,
        this.parentUI,
        this.engine,
      );
    } else {
      node = new UINode(
        userKey,
        generateNextKey(this.pendingChildrenState.size()),
        params,
        slot,
        ctor,
        this,
        this.parentUI,
        this.engine,
        tag,
      );
    }

    this.pendingChildrenState.put(node);
    return node;
  }

  dispose(): void {
    // delete any DOM / whatever nodes we have
    // Propagate removal of data to all children

    // Remove subscriptions
    this.c.dispose();

    // Parent component should alredy not to have children, but we can have sanity check there
    for (const child of this.children) {
      child.dispose();
    }

    // Mark component as not dirty, as there is no point in keeping that item anymore
    this.engine.dispose(this);
  }
}

export class UINode extends Node {
  public uiChildren: IndexedMap<UINode, "key"> = new IndexedMap("key", [
    "userKey",
  ]);
  public pendingUIChildrenState!: IndexedMap<UINode, "key">;
  protected domNode: Maybe<HTMLElement>;
  protected domText: Maybe<Text>;
  constructor(
    userKey: Maybe<Key>,
    internalKey: Key,
    p: Wildcard,
    slot: Maybe<() => void>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    parent: Node,
    parentUI: UINode,
    engine: DomEngine,
    public tag: string,
  ) {
    super(userKey, internalKey, p, slot, ctor, parent, parentUI, engine);
    // Root element does not have parentUI
    this.parentUI?.appendUIChild(this);
  }

  // @ts-ignore
  get publicApi() {
    return this.domNode ?? this.domText;
  }

  appendUIChild(node: UINode) {
    this.uiChildren.put(node);
  }

  protected createNewNode(
    userKey: Maybe<Key>,
    ctor: NodeBuilder<Wildcard, Wildcard>,
    params: Maybe<Wildcard>,
    slot: Maybe<() => void>,
    tag: Maybe<string>,
  ): Node {
    let node: Node;
    if (tag == null) {
      node = new Node(
        userKey,
        generateNextKey(this.pendingChildrenState.size()),
        params,
        slot,
        ctor,
        this,
        this,
        this.engine,
      );
    } else {
      node = new UINode(
        userKey,
        generateNextKey(this.pendingChildrenState.size()),
        params,
        slot,
        ctor,
        this,
        this,
        this.engine,
        tag,
      );
    }

    this.pendingChildrenState.put(node);
    return node;
  }

  renderUI() {
    // rerender
    if (this.domText != null) {
      const params = this.p;
      if (typeof params === "string") {
        this.domText.textContent = params;
      }
    }
    if (this.domNode != null) {
      const params = this.p;
      const element = this.domNode;
      if (typeof params === "object") {
        for (const key in params) {
          if (element.getAttribute(key) !== params[key]) {
            element.setAttribute(key, params[key]);
          }
        }
      }
    }
    // mount
    if (this.tag === "text") {
      this.domText = document.createTextNode(this.p);
      this.parentUI.domNode?.appendChild(this.domText);
    } else {
      this.domNode = document.createElement(this.tag);
      const params = this.p;
      const element = this.domNode;
      if (typeof params === "object") {
        for (const key in params) {
          if (element.getAttribute(key) !== params[key]) {
            element.setAttribute(key, params[key]);
          }
        }
      }
      this.parentUI.domNode?.appendChild(this.domNode);
    }
  }

  render() {
    this.isRendering();
    __DEV__ && console.log("UI render:", this.tag, this.key);
    this.renderUI();
    //this.layoutNode = this.layout.renderNode(this);
    this.lifecycle.render();
    const { justMounted } = this.didRender();
    if (justMounted) {
      this.lifecycle.didMount?.();
    } else {
      this.lifecycle.didUpdate?.();
    }
  }

  dispose(): void {
    super.dispose();
    const toDelete = this.domNode ?? this.domText;
    if (toDelete != null && this.parentUI != null) {
      this.parentUI.domNode?.removeChild(toDelete);
    }
    this.domNode = null;
    this.domText = null;
  }
}

export class RootNode extends UINode {
  constructor(htmlElement: HTMLElement, slot: () => void, engine: DomEngine) {
    super(
      null,
      "root",
      null,
      slot,
      /* ctor */ (c) => ({
        render() {
          c.slot?.();
        },
      }),
      // @ts-ignore
      /* parent */ null,
      /* parentUI */ null,
      engine,
      /* tag */ null,
    );
    this.domNode = htmlElement;
  }

  renderUI() {}
}
