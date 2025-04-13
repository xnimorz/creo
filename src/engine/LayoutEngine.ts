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
import { Maybe } from "../data-structures/maybe/Maybe";
import { InternalComponent } from "./InternalComponent";
import { Key } from "./Key";
import { Registry, RegistryNode } from "./Registry";

export abstract class LayoutEngine {
  registry: Registry = new Registry();

  generateKey(): Key {
    const registryNode: Maybe<RegistryNode> =
      this.registry.renderingQueue.at(-1)?.registry;
    assertJust(
      registryNode,
      "Cannot generate unique key for top-level component",
    );
    return registryNode.generateKey();
  }

  peekRenderingComponent(): Maybe<InternalComponent> {
    return this.registry.renderingQueue.at(-1);
  }

  startComponentRender(component: InternalComponent) {
    this.registry.renderingQueue.addToEnd(component.key, component);
  }

  endComponentRender(component: InternalComponent) {
    const maybeComponent = this.registry.renderingQueue.at(-1);
    if (maybeComponent !== component) {
      throw new Error(
        "Cannot close component rendering due to component mismatch",
      );
    }
    this.registry.renderingQueue.delete(component.key);
  }
}
