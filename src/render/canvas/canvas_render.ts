import type { ViewRecord } from "@/internal/internal_view";
import { F_PRIMITIVE, F_MOVED } from "@/internal/internal_view";
import type { IRender } from "../render_interface";
import { $primitive } from "@/public/primitive";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";
import type { CanvasNode } from "./canvas_types";
import { CanvasStyleSheet } from "./canvas_style";
import { createNode, insertChild, removeChild, moveChild, layoutTree } from "./canvas_node";
import { paintTree, type PaintContext } from "./canvas_paint";
import { setupEvents, type EventCleanup } from "./canvas_events";
import { InputOverlay } from "./canvas_input";

// ---------------------------------------------------------------------------
// Event prop detection (same logic as HtmlRender)
// ---------------------------------------------------------------------------

function isEventProp(key: string): boolean {
  return (
    key.charCodeAt(0) === 111 && // 'o'
    key.charCodeAt(1) === 110 && // 'n'
    key.charCodeAt(2) >= 65 &&   // 'A'
    key.charCodeAt(2) <= 90      // 'Z'
  );
}

function eventName(prop: string): string {
  // onClick → click, onPointerDown → pointerDown
  return prop[2]!.toLowerCase() + prop.slice(3);
}

// ---------------------------------------------------------------------------
// CanvasRender
// ---------------------------------------------------------------------------

export type CanvasRenderOptions = {
  styleSheet?: CanvasStyleSheet;
};

export class CanvasRender implements IRender<CanvasNode> {
  engine!: Engine;

  readonly #canvasEl: HTMLCanvasElement;
  readonly #paintCtx: PaintContext;
  readonly #styleSheet: CanvasStyleSheet;
  /** Virtual root node — wraps all top-level primitives like HtmlRender's container. */
  #root: CanvasNode;
  #frameDirty = false;
  #eventCleanup: EventCleanup | null = null;
  #inputOverlay: InputOverlay | null = null;

  constructor(canvasEl: HTMLCanvasElement, options?: CanvasRenderOptions) {
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

    // Size canvas for high-DPI
    const displayW = canvasEl.clientWidth || canvasEl.width;
    const displayH = canvasEl.clientHeight || canvasEl.height;
    canvasEl.width = displayW * dpr;
    canvasEl.height = displayH * dpr;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("CanvasRender: failed to get 2d context");

    this.#canvasEl = canvasEl;
    this.#paintCtx = { ctx, dpr };
    this.#styleSheet = options?.styleSheet ?? new CanvasStyleSheet();

    // Create a virtual root node that acts as the canvas container
    this.#root = createNode("__root", this.#styleSheet.resolve(undefined, undefined));

    // Input overlay for <input>/<textarea> nodes
    if (typeof document !== "undefined") {
      this.#inputOverlay = new InputOverlay(canvasEl, dpr);
    }

    // Set up event listeners
    this.#eventCleanup = setupEvents(
      { canvasEl, dpr },
      () => this.#root,
      this.#inputOverlay,
    );
  }

  // ---------------------------------------------------------------------------
  // IRender implementation
  // ---------------------------------------------------------------------------

  render(view: ViewRecord): void {
    const existing = view.renderRef as Maybe<CanvasNode>;

    if (!existing) {
      // --- Mount ---
      if (view.flags & F_PRIMITIVE) {
        const tag = view.viewFn[$primitive]!;
        const props = tag === "text"
          ? {} as Record<string, unknown>
          : (view.props as Record<string, unknown>);

        const style = this.#styleSheet.resolve(
          props.class as string | undefined,
          props.style as string | undefined,
        );

        const textContent = tag === "text" ? String(view.props) : null;
        const node = createNode(tag, style, textContent);

        // Extract events
        this.#extractEvents(node, props);

        // Find parent CanvasNode (falls back to virtual root)
        const parentNode = this.#findParentNode(view);
        const insertIdx = this.#computeInsertIndex(view, parentNode);
        insertChild(parentNode, node, insertIdx);

        node.prevProps = tag === "text" ? null : { ...props };
        view.renderRef = node;
      } else {
        // Composite: no canvas node, just mark as mounted
        view.renderRef = true;
      }

      this.#scheduleFrame();
      return;
    }

    // --- Update ---

    if (view.flags & F_MOVED) {
      if (view.flags & F_PRIMITIVE) {
        const node = existing;
        const parentNode = node.parent;
        if (parentNode) {
          const newIdx = this.#computeInsertIndex(view, parentNode);
          moveChild(parentNode, node, newIdx);
        }
      }
    }

    if (!(view.flags & F_PRIMITIVE)) return;

    const node = existing;
    const tag = view.viewFn[$primitive]!;

    if (tag === "text") {
      const newText = String(view.props);
      if (node.text !== newText) {
        node.text = newText;
      }
    } else {
      const nextProps = view.props as Record<string, unknown>;
      if (node.prevProps !== nextProps) {
        // Update style
        node.style = this.#styleSheet.resolve(
          nextProps.class as string | undefined,
          nextProps.style as string | undefined,
        );
        // Update events
        node.events = {};
        this.#extractEvents(node, nextProps);
        node.prevProps = { ...nextProps };
      }
    }

    this.#scheduleFrame();
  }

  unmount(view: ViewRecord): void {
    if (view.flags & F_PRIMITIVE) {
      const node = view.renderRef as Maybe<CanvasNode>;
      if (node && node.parent) {
        removeChild(node.parent, node);
      }
    }
    view.renderRef = undefined;
    this.#scheduleFrame();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get styleSheet(): CanvasStyleSheet {
    return this.#styleSheet;
  }

  get rootNode(): CanvasNode {
    return this.#root;
  }

  dispose(): void {
    if (this.#eventCleanup) this.#eventCleanup();
    if (this.#inputOverlay) this.#inputOverlay.dispose();
  }

  // ---------------------------------------------------------------------------
  // Internal: frame scheduling
  // ---------------------------------------------------------------------------

  #scheduleFrame(): void {
    if (this.#frameDirty) return;
    this.#frameDirty = true;
    requestAnimationFrame(() => this.#paint());
  }

  #paint(): void {
    this.#frameDirty = false;

    const { dpr } = this.#paintCtx;
    const w = this.#canvasEl.clientWidth || (this.#canvasEl.width / dpr);
    const h = this.#canvasEl.clientHeight || (this.#canvasEl.height / dpr);

    // Layout pass
    layoutTree(this.#root, w, h);

    // Paint pass
    paintTree(this.#paintCtx, this.#root);

    // Reposition input overlay if active
    if (this.#inputOverlay?.activeNode) {
      this.#inputOverlay.reposition();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: tree navigation
  // ---------------------------------------------------------------------------

  #findParentNode(view: ViewRecord): CanvasNode {
    let parent = view.parent;
    while (parent) {
      if (parent.flags & F_PRIMITIVE) {
        const ref = parent.renderRef as Maybe<CanvasNode>;
        if (ref && typeof ref === "object" && "tag" in ref) return ref;
      }
      parent = parent.parent;
    }
    return this.#root;
  }

  /**
   * Count how many canvas nodes appear before `view` under the same
   * canvas parent. Walks up through composites to align with the
   * canvas parent's coordinate space.
   */
  #computeInsertIndex(view: ViewRecord, canvasParent: CanvasNode): number {
    // Walk up through the view tree until we reach the view whose
    // canvas node IS canvasParent (or the root). At each level,
    // count canvas nodes in preceding siblings.
    let count = 0;
    let current: ViewRecord = view;
    let parent = current.parent;

    while (parent) {
      // Count canvas nodes in siblings before `current`
      if (parent.children) {
        const idx = parent.children.indexOf(current);
        for (let i = 0; i < idx; i++) {
          count += this.#countCanvasNodes(parent.children[i]!);
        }
      }

      // If this parent IS the canvas parent's view, stop
      if (parent.flags & F_PRIMITIVE) {
        const ref = parent.renderRef;
        if (ref === canvasParent) break;
      }

      // Walk up through composites
      current = parent;
      parent = parent.parent;
    }

    return count;
  }

  #countCanvasNodes(view: ViewRecord): number {
    if (!view.renderRef) return 0;
    if (view.flags & F_PRIMITIVE) return 1;
    let count = 0;
    if (view.children) {
      for (const child of view.children) {
        count += this.#countCanvasNodes(child);
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Internal: extract event handlers from props
  // ---------------------------------------------------------------------------

  #extractEvents(node: CanvasNode, props: Record<string, unknown>): void {
    for (const key in props) {
      if (isEventProp(key) && typeof props[key] === "function") {
        node.events[eventName(key)] = props[key] as Function;
      }
    }
  }
}
