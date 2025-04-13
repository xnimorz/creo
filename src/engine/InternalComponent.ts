import { ComponentBuilder, PublicComponent } from "../Component";
import { isNone, Maybe } from "../data-structures/maybe/Maybe";
import { Wildcard } from "../data-structures/wildcard/wildcard";
import { Key } from "./Key";
import { LayoutEngine } from "./LayoutEngine";
import { RegistryNode } from "./Registry";

export class InternalComponent {
  key: Key;
  layout: LayoutEngine;
  registry: RegistryNode;
  publicComponent: PublicComponent;

  constructor(
    key: Key,
    layout: LayoutEngine,
    publicComponent: PublicComponent,
  ) {
    this.layout = layout;
    this.key = key;
    this.publicComponent = publicComponent;
    this.registry = layout.registry.createRegistryNode();
  }

  dispose() {}
}
