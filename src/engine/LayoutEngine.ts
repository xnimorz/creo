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

import { assertJust } from "../data-structures/assert/assert";
import {
  LinkedHashMap,
  LinkedMap,
} from "../data-structures/linked-hash-map/LinkedHashMap";
import { List } from "../data-structures/list/List";
import { isJust, Maybe } from "../data-structures/maybe/Maybe";
import { InternalComponent } from "./InternalComponent";
import { Key } from "./Key";

export abstract class LayoutEngine {
  // Queue of currently rendering items
  renderingQueue: List<InternalComponent> = List();

  dirtyComponents: LinkedHashMap<Key, InternalComponent> = LinkedMap();
  setDirtyComponent(component: InternalComponent, isDirty: boolean) {
    if (isDirty) {
      if (!this.dirtyComponents.get(component.key)) {
        this.dirtyComponents.addToEnd(component.key, component);
      }
    } else {
      this.dirtyComponents.delete(component.key);
    }
  }
  isComponentDirty(component: InternalComponent) {
    return isJust(this.dirtyComponents.get(component.key));
  }

  peekComponentRender(): Maybe<InternalComponent> {
    return this.renderingQueue.at(-1)?.value;
  }

  startComponentRender(component: InternalComponent) {
    this.renderingQueue.addToEnd(component);
  }

  endComponentRender(component: InternalComponent) {
    const maybeComponent = this.renderingQueue.at(-1)?.node;
    if (maybeComponent !== component) {
      throw new Error(
        "Cannot close component rendering due to component mismatch",
      );
    }
    this.renderingQueue.delete(-1);
  }

  lowLevel<P extends object>(tag: string, params?: P) {}
}
