import { LinkedMap } from "../data-structures/linked-map/LinkedMap";
import { Maybe } from "../data-structures/maybe/Maybe";
import { IRenderCycle } from "./IRenderCycle";
import { Node } from "./Node";

export class Registry implements IRenderCycle {
  protected needRender: LinkedMap<Node, "key"> = new LinkedMap("key");
  protected rendering: LinkedMap<Node, "key"> = new LinkedMap("key");
  protected register: LinkedMap<Node, "key"> = new LinkedMap("key");
  protected mounting: LinkedMap<Node, "key"> = new LinkedMap("key");

  public newNode(node: Node) {
    this.register.put(node);
    this.needRender.put(node);
    this.mounting.put(node);
  }

  public willRender(node: Node) {
    this.needRender.putFirst(node);
    this.rendering.delete(node.key);
  }

  public isRendering(node: Node) {
    this.needRender.delete(node.key);
    this.rendering.put(node);
  }

  public didRender(node: Node): { justMounted: boolean } {
    this.rendering.delete(node.key);
    return {
      justMounted: this.mounting.delete(node.key),
    };
  }

  public shouldUpdateNode(node: Node): boolean {
    return this.needRender.has(node);
  }

  public dispose(node: Node) {
    this.register.delete(node.key);
    this.rendering.delete(node.key);
    this.mounting.delete(node.key);
    this.needRender.delete(node.key);
  }

  public getNextToRender(): Maybe<Node> {
    return this.needRender.at(0);
  }

  public getNextRendering(): Maybe<Node> {
    return this.rendering.at(-1);
  }
}
