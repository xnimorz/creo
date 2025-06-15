import { Node } from "./Node";

export interface IRenderCycle {
  newNode(node: Node): void;
  willRender(node: Node): void;
  isRendering(node: Node): void;
  didRender(node: Node): { justMounted: boolean };
  dispose(node: Node): void;
}
