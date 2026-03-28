import type { View } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
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
  /** The root JSON node after mount. */
  root: Maybe<JsonNode>;

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
        const nextSibling = this.getNextSibling(view);
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
    const tag = view.viewFn[$primitive];
    existing.props = tag === "text"
      ? { content: view.props }
      : { ...view.props };
  }

  unmount(view: View): void {
    const childNode = view.renderRef as Maybe<JsonNode>;
    const parentNode = view.parent?.renderRef as Maybe<JsonNode>;
    if (parentNode && childNode) {
      const idx = parentNode.children.indexOf(childNode);
      if (idx !== -1) parentNode.children.splice(idx, 1);
    }
  }

  // -- Internal ---------------------------------------------------------------

  private getNextSibling(view: View): Maybe<View> {
    return view.parent?.virtualDom?.getNode(view)?.getNext()?.v;
  }

  private buildNode(view: View): JsonNode {
    const tag = view.viewFn[$primitive];

    const props = tag === "text"
      ? { content: view.props }
      : { ...view.props };

    const node: JsonNode = {
      type: tag ?? "composite",
      props,
      children: [],
    };
    if (view.userKey != null) node.key = view.userKey;
    view.renderRef = node;
    return node;
  }
}
