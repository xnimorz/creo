import { PublicComponent } from "../Component";
import { ComponentBuilder } from "../creo";
import { assertJust } from "../data-structures/assert/assert";
import {
  LinkedHashMap,
  LinkedMap,
} from "../data-structures/linked-hash-map/LinkedHashMap";
import { isJust, isNone, Maybe } from "../data-structures/maybe/Maybe";
import { generateNextKey } from "../data-structures/simpleKey/simpleKey";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { CreoContext } from "./Context";
import { Key } from "./Key";
import { LayoutEngine } from "./LayoutEngine";

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

type UpdateDirectiveType = {
  updateDirective: UpdateDirectiveEnum;
  component: Maybe<InternalComponent>;
};

export class InternalComponent {
  key: Key;
  layout: LayoutEngine;
  parent: Maybe<InternalComponent>;
  publicComponent: PublicComponent<Wildcard, Wildcard>;
  c: CreoContext<Wildcard>;
  // Pending state of component's children, to replace `children` state after the component render cycle ends
  private pendingChildren: LinkedHashMap<Key, InternalComponent> = LinkedMap();
  // Current "de-facto" state of component's children
  private children: LinkedHashMap<Key, InternalComponent> = LinkedMap();
  // The link to the component which is going to be rendered next.
  // When render of lower component is completed, renderingCursor advances
  private renderCursor: Maybe<Key>;
  // How deep the component is placed
  depth: number = 0;

  setDirty(dirty: boolean) {
    this.layout.setDirtyComponent(this, dirty);
  }
  isDirty() {
    return this.layout.isComponentDirty(this);
  }

  // Moves #renderCurost further
  advanceRenderingCursor() {
    if (isNone(this.renderCursor)) {
      return;
    }
    this.renderCursor = this.children.getNextKey(this.renderCursor);
  }

  generateKey(): Key {
    return `creo-${generateNextKey()}-${this.children.size()}`;
  }

  // Function finds a correct behaviour for a new Component
  // That function mutates current `children` and renderingCursot of the active registry if needed.
  generateUpdateDirective(
    key: Maybe<Key>,
    ctor: ComponentBuilder<Wildcard, Wildcard>,
  ): UpdateDirectiveType {
    const expectedChild: Maybe<InternalComponent> =
      this.renderCursor != null ? this.children.get(this.renderCursor) : null;

    // Happy path: expectedNextComponent matches with new state:
    if (
      isJust(expectedChild) &&
      expectedChild.publicComponent.ctor === ctor &&
      // TODO: We should respect & identify artificially generated keys too
      (isNone(key) || key === expectedChild.key)
    ) {
      return {
        updateDirective: UpdateDirectiveEnum.REUSE,
        component: expectedChild,
      };
    }

    // Unhappy path exploration.
    const maybeKeyedMatchedChildren: Maybe<InternalComponent> = isJust(key)
      ? this.children.get(key)
      : null;

    // Case 1: Key, no next component, but matched key: something went wrong
    if (
      isNone(expectedChild) &&
      isJust(key) &&
      isJust(maybeKeyedMatchedChildren)
    ) {
      throw new Error(`Detected key duplication: ${key}`);
    }

    // Case 2: Key, matched key, not matched next element
    if (
      isJust(expectedChild) &&
      isJust(key) &&
      isJust(maybeKeyedMatchedChildren)
    ) {
      // We have matched key, but their constructors are different
      // In theory that process is REPLACE, but for external usages, it works exactly the same way as NEW
      // The difference is purely internal
      if (maybeKeyedMatchedChildren.publicComponent.ctor !== ctor) {
        return {
          updateDirective: UpdateDirectiveEnum.REPLACE,
          component: maybeKeyedMatchedChildren,
        };
      }
      // TODO detect potential key duplication?
      // Everything is fine, we just need to move that item to different place
      return {
        updateDirective: UpdateDirectiveEnum.MOVE,
        component: maybeKeyedMatchedChildren,
      };
    }

    // Default outcome: Component creation
    // Cases:
    // 1. No key, component mismatch or no component
    // 2. Key, no next component, no matched key
    return {
      updateDirective: UpdateDirectiveEnum.NEW,
      component: null,
    };
  }

  createNewInternalComponent<P>(
    key: Maybe<Key>,
    ctor: ComponentBuilder<P, Wildcard>,
    initialParams: P,
  ): InternalComponent {
    const ic = new InternalComponent(
      key != null ? key : this.generateKey(),
      this.layout,
      ctor,
      this,
      this.depth + 1,
      initialParams,
    );

    return ic;
  }

  reconsileChild<P = void>(
    key: Maybe<Key>,
    ctor: ComponentBuilder<P, Wildcard>,
    params: P,
  ): InternalComponent {
    const updateDirective = this.generateUpdateDirective(key, ctor);
    switch (updateDirective.updateDirective) {
      case UpdateDirectiveEnum.REUSE: {
        assertJust(updateDirective.component, "Cannot re-use null component");
        this.pendingChildren.addToEnd(
          updateDirective.component.key,
          updateDirective.component,
        );
        this.children.delete(updateDirective.component.key);
        this.advanceRenderingCursor();
        // The component can decide on its own if the component needs to get updated
        updateDirective.component.reconsileComponentDirtyStatus(params);
        return updateDirective.component;
      }
      case UpdateDirectiveEnum.MOVE: {
        // TODO: move all DOM children which are connected to the top-level
      }
      case UpdateDirectiveEnum.NEW: {
        return this.createNewInternalComponent(key, ctor, params);
      }
      case UpdateDirectiveEnum.REPLACE: {
        assertJust(updateDirective.component, "Cannot replace null component");
        const component = updateDirective.component;
        // Delete conflicting element, as they should not exist anymore
        this.children.delete(component.key);
        // Cleanup the component:
        component.dispose();
        return this.createNewInternalComponent(key, ctor, params);
      }
    }
  }

  // Checks if component should be as dirty
  // If so, marks it in LayoutEngine
  // Updates the component state
  // Returns result (if the component is dirty)
  reconsileComponentDirtyStatus<P>(
    newParams: P,
    needToMoveUiBlocks?: boolean,
  ): boolean {
    // Component is already marked as dirty. No more action requires
    if (this.isDirty()) {
      this.c.newParams(newParams);
      return true;
    }
    // If the parent moves to different position, the component has to be marked as dirty.
    if (needToMoveUiBlocks) {
      this.c.newParams(newParams);
      this.setDirty(true);
      return true;
    }

    if (this.publicComponent.shouldUpdate(newParams)) {
      this.c.newParams(newParams);
      this.setDirty(true);
      return true;
    }
    // TODO: implement further checks for Low-level components
    return false;
  }

  constructor(
    key: Key,
    layout: LayoutEngine,
    ctor: ComponentBuilder<Wildcard, Wildcard>,
    parent: Maybe<InternalComponent>,
    depth: number,
    initialParams: Wildcard,
  ) {
    this.layout = layout;
    this.key = key;
    this.parent = parent;
    this.depth = depth;
    this.c = new CreoContext(this, initialParams);
    this.publicComponent = new PublicComponent(ctor, this.c);
    this.setDirty(true);
  }

  // Updates existing component
  render() {
    // #region Render pre-setup
    this.pendingChildren = LinkedMap();
    this.renderCursor = this.children.at(0)?.key;
    this.layout.startComponentRender(this);
    this.setDirty(false);

    // #region Component Render in progress
    this.publicComponent.render();

    // #region Component redner wrap-up
    // When the rendering cycle ends, all items starting
    // from this.renderingCursor were not used and hence, need to be deleted
    while (isJust(this.renderCursor)) {
      this.children.get(this.renderCursor)?.dispose();
      this.advanceRenderingCursor();
    }
    // At the end of the cycle, we replace children with pending children (this.renderingChildren)
    this.children = this.pendingChildren;

    // Before completing the render of parent, we want to ensure children are updated
    for (const [_key, ic] of this.children) {
      if (ic.reconsileComponentDirtyStatus(ic.c.p)) {
        ic.render();
      }
    }

    this.layout.endComponentRender(this);
  }

  dispose() {
    // delete any DOM / whatever nodes we have
    // Propagate removal of data to all children

    // Remove subscriptions
    this.c.dispose();

    // Parent component should alredy not to have children, but we can have sanity check there

    // Mark component as not dirty, as there is no point in keeping that item anymore
    this.layout.setDirtyComponent(this, false);
  }
}
