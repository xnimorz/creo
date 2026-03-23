import type { View } from "@/internal/internal_view";
import type { IRender, PrimitiveRenderHandler } from "./render_interface";
import { PrimitiveRegistry } from "./primitive_registry";
import type { PrimitiveComponent } from "@/public/primitive";
import {
  div,
  span,
  text,
  button,
  input,
  img,
} from "@/public/primitives/primitives";
import type { Maybe } from "@/functional/maybe";

// ---------------------------------------------------------------------------
// JSON node — the output type
// ---------------------------------------------------------------------------

export type JsonNode = {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[];
  key?: string | number;
};

// ---------------------------------------------------------------------------
// JSON Renderer
// ---------------------------------------------------------------------------

export class JsonRender implements IRender<JsonNode> {
  private primitives = new PrimitiveRegistry<JsonNode>();

  /** The root JSON node after mount. */
  root: Maybe<JsonNode>;

  constructor() {
    this.registerBuiltins();
  }

  // -- IRender ----------------------------------------------------------------

  render(view: View): void {
    const existing = view.renderRef as Maybe<JsonNode>;

    if (!existing) {
      // Mount
      const node = this.buildNode(view);
      if (!view.parent) {
        this.root = node;
        return;
      }
      const parentNode = view.parent.renderRef as Maybe<JsonNode>;
      if (parentNode) {
        parentNode.children.push(node);
      }
      return;
    }

    // Update: reposition + patch props
    const parentNode = view.parent?.renderRef as Maybe<JsonNode>;
    if (parentNode) {
      const oldIdx = parentNode.children.indexOf(existing);
      if (oldIdx !== -1) {
        const nextSibling = view.getNextSibling();
        const nextNode = nextSibling?.renderRef as Maybe<JsonNode>;
        const expectedIdx = nextNode
          ? parentNode.children.indexOf(nextNode)
          : parentNode.children.length;
        if (oldIdx !== expectedIdx && oldIdx !== expectedIdx - 1) {
          parentNode.children.splice(oldIdx, 1);
          const insertIdx = nextNode
            ? parentNode.children.indexOf(nextNode)
            : parentNode.children.length;
          parentNode.children.splice(insertIdx, 0, existing);
        }
      }
    }
    existing.props = { ...view.props };
  }

  unmount(view: View): void {
    const childNode = view.renderRef as Maybe<JsonNode>;
    const parentNode = view.parent?.renderRef as Maybe<JsonNode>;
    if (parentNode && childNode) {
      const idx = parentNode.children.indexOf(childNode);
      if (idx !== -1) parentNode.children.splice(idx, 1);
    }
  }

  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<JsonNode>][],
  ): void {
    this.primitives.register(entries);
  }

  // -- Internal ---------------------------------------------------------------

  /** Build output for this view only. Children mount themselves. */
  private buildNode(view: View): JsonNode {
    const handler = this.primitives.getHandler(view.viewFn);

    if (handler) {
      const node = handler.render(view);
      if (view.userKey != null) node.key = view.userKey;
      view.renderRef = node;
      return node;
    }

    const node: JsonNode = {
      type: "composite",
      props: { ...view.props },
      children: [],
    };
    if (view.userKey != null) node.key = view.userKey;
    view.renderRef = node;
    return node;
  }

  private registerBuiltins() {
    const simple = (type: string): PrimitiveRenderHandler<JsonNode> => ({
      render: (view: View): JsonNode => ({
        type,
        props: { ...view.props },
        children: [],
      }),
    });

    this.registerPrimitive([
      [div, simple("div")],
      [span, simple("span")],
      [text, simple("text")],
      [button, simple("button")],
      [input, simple("input")],
      [img, simple("img")],
    ]);
  }
}
