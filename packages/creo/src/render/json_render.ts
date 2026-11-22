import type { ViewRecord } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

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
  root: Maybe<JsonNode>;

  engine!: Engine;
  constructor() {
    this.root = null;
  }

  // -- IRender ----------------------------------------------------------------

  render(view: ViewRecord): void {
    const existing = view.renderRef as Maybe<JsonNode>;

    if (!existing) {
      const node = this.buildNode(view);
      if (!view.parent) {
        this.root = node;
        return;
      }
      const parentNode = view.parent.renderRef as Maybe<JsonNode>;
      if (parentNode) {
        const idx = view.pos;
        if (idx >= 0 && idx < parentNode.children.length) {
          parentNode.children.splice(idx, 0, node);
        } else {
          parentNode.children.push(node);
        }
      }
      return;
    }

    if (view.parent) {
      const parentNode = view.parent.renderRef as Maybe<JsonNode>;
      if (parentNode) {
        const targetIdx = view.pos;
        if (targetIdx >= 0 && parentNode.children[targetIdx] !== existing) {
          const oldIdx = parentNode.children.indexOf(existing);
          if (oldIdx !== -1) {
            parentNode.children.splice(oldIdx, 1);
            parentNode.children.splice(
              Math.min(targetIdx, parentNode.children.length),
              0,
              existing,
            );
          }
        }
      }
    }
    const tag = view.viewFn[$primitive];
    existing.props =
      tag === "text" ? { content: view.props } : { ...view.props };
  }

  unmount(view: ViewRecord): void {
    const childNode = view.renderRef as Maybe<JsonNode>;
    if (!childNode || !view.parent) return;
    const parentNode = view.parent.renderRef as Maybe<JsonNode>;
    if (parentNode) {
      const children = parentNode.children;
      // Try view.pos first, fall back to indexOf
      let idx = view.pos;
      if (idx < 0 || idx >= children.length || children[idx] !== childNode) {
        idx = children.indexOf(childNode);
      }
      if (idx !== -1) children.splice(idx, 1);
    }
  }

  // -- Internal ---------------------------------------------------------------

  private buildNode(view: ViewRecord): JsonNode {
    const tag = view.viewFn[$primitive];

    const props = tag === "text" ? { content: view.props } : { ...view.props };

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
