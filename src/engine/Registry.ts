import { ComponentBuilder } from "../Component";
import { assertJust } from "../data-structures/assert/assert";
import {
  LinkedHashMap,
  LinkedMap,
} from "../data-structures/linked-hash-map/LinkedHashMap";
import { isJust, isNone, Maybe } from "../data-structures/maybe/Maybe";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { InternalComponent } from "./InternalComponent";
import { Key } from "./Key";

export enum ComponentRegistrationAction {
  MOVE = "move",
  NEW = "new",
  EXIST = "exist",
}

type ComponentRegistration = {
  action: ComponentRegistrationAction;
  registryNode: RegistryNode;
};

type ComponentPlacement = {
  action: ComponentRegistrationAction;
  component: Maybe<InternalComponent>;
};

/**
 * Components registry, keeps the links to all Internal Components to apply updates,
 * mark components as dirty correctly
 */
export class Registry {
  // Queue of currently rendering items
  renderingQueue: LinkedHashMap<Key, InternalComponent> = LinkedMap();

  // List of items marked as needed to be re-rendered
  dirtyQueue: LinkedHashMap<Key, InternalComponent> = LinkedMap();

  root: Maybe<RegistryNode>;

  // Function finds a correct behaviour for a new Component
  // That function mutates current `children` and renderingCursot of the active registry if needed.
  componentPlacement(
    key: Maybe<Key>,
    ctor: ComponentBuilder<Wildcard, Wildcard>,
  ): ComponentPlacement {
    if (this.renderingQueue.size() === 0 && isNone(this.root)) {
      throw new Error("Attemp to place component for not-initialised registry");
    }
    const maybeCurrentlyRenderingComponent = this.renderingQueue.at(-1);
    assertJust(
      maybeCurrentlyRenderingComponent,
      "Rendering queue is empty, cannot render component outside rendering",
    );
    const currentlyRenderingComponent = maybeCurrentlyRenderingComponent;
    const expectedNextComponent: Maybe<InternalComponent> =
      currentlyRenderingComponent.registry.renderingCursor != null
        ? currentlyRenderingComponent.registry.children.get(
            currentlyRenderingComponent.registry.renderingCursor,
          )
        : null;

    // Happy path: expectedNextComponent matches with new state:
    if (
      isJust(expectedNextComponent) &&
      expectedNextComponent.publicComponent.ctor === ctor &&
      (isNone(key) || key === expectedNextComponent.key)
    ) {
      currentlyRenderingComponent.registry.renderingChildren.addToEnd(
        expectedNextComponent.key,
        expectedNextComponent,
      );
      currentlyRenderingComponent.registry.advanceRenderingCursor();

      return {
        action: ComponentRegistrationAction.EXIST,
        component: expectedNextComponent,
      };
    }

    // Unhappy path exploration.
    const maybeKeyedMatchedChildren: Maybe<InternalComponent> = isJust(key)
      ? currentlyRenderingComponent.registry.children.get(key)
      : null;

    // Case 1: Key, no next component, but matched key: something went wrong
    if (
      isNone(expectedNextComponent) &&
      isJust(key) &&
      isJust(maybeKeyedMatchedChildren)
    ) {
      throw new Error(`Detected key duplication: ${key}`);
    }

    // Case 2: Key, matched key, not matched next element
    if (
      isJust(expectedNextComponent) &&
      isJust(key) &&
      isJust(maybeKeyedMatchedChildren)
    ) {
      // We have matched key, but their constructors are different
      // In theory that process is REPLACE, but for external usages, it works exactly the same way as NEW
      // The difference is purely internal
      if (maybeKeyedMatchedChildren.publicComponent.ctor !== ctor) {
        // Delete conflicting element, as they should not exist anymore
        currentlyRenderingComponent.registry.children.delete(key);
        // Cleanup the component:
        maybeKeyedMatchedChildren.dispose();

        return {
          action: ComponentRegistrationAction.NEW,
          component: null,
        };
      }
      // TODO detect potential key duplication?
      // Everything is fine, we just need to move that item to different place
      currentlyRenderingComponent.registry.children.delete(key);
      return {
        action: ComponentRegistrationAction.MOVE,
        component: maybeKeyedMatchedChildren,
      };
    }

    // Default outcome: Component creation
    // Cases:
    // 1. No key, component mismatch or no component
    // 2. Key, no next component, no matched key
    return {
      action: ComponentRegistrationAction.NEW,
      component: null,
    };
  }

  registerNewComponent(component: InternalComponent): ComponentRegistration {
    // no rendering items, render happens on a root component
    if (this.renderingQueue.size() === 0 && isNone(this.root)) {
      this.root = new RegistryNode(0, component);
      return {
        action: ComponentRegistrationAction.NEW,
        registryNode: this.root,
      };
    }
    const maybeParentComponent = this.renderingQueue.at(-1);
    assertJust(
      maybeParentComponent,
      "Should not happen. No rendering component despite check",
    );
    // TODO on key

    const parentComponent = maybeParentComponent;
    const registryNode = new RegistryNode(
      parentComponent.registry.level + 1,
      component,
    );

    return registryNode;
  }
}

export class RegistryNode {
  // Pending state of component's children, to replace `children` state after the component render cycle ends
  renderingChildren: LinkedHashMap<Key, InternalComponent> = LinkedMap();

  // Current "de-facto" state of component's children
  children: LinkedHashMap<Key, InternalComponent> = LinkedMap();
  // The link to the component which is going to be rendered next.
  // When render of lower component is completed, renderingCursor advances
  renderingCursor: Maybe<Key>;
  component: InternalComponent;
  level: number;

  generateKey(): Key {
    return `creo-${this.generateKey()}-${this.children.size}`;
  }

  advanceRenderingCursor() {
    if (isNone(this.renderingCursor)) {
      return;
    }
    this.renderingCursor = this.children.getNextKey(this.renderingCursor);
  }

  constructor(level: number, component: InternalComponent) {
    this.component = component;
    this.level = level;
  }

  startComponentRender() {
    this.renderingChildren = LinkedMap();
    this.renderingCursor = this.children.at(0)?.key;
  }

  endComponentRender() {
    // When the rendering cycle ends, all items starting
    // from this.renderingCursor were not used and hence, need to be deleted
    while (isJust(this.renderingCursor)) {
      this.children.get(this.renderingCursor)?.dispose();
      this.advanceRenderingCursor();
    }
    // At the end of the cycle, we replace children with pending children (this.renderingChildren)
    this.children = this.renderingChildren;
  }
}
