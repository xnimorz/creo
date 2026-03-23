import type { View } from "@/internal/internal_view";
import type { IRender, PrimitiveRenderHandler } from "./render_interface";
import { PrimitiveRegistry } from "./primitive_registry";
import type { PrimitiveComponent } from "@/public/primitive";
import { text, getHtmlTag } from "@/public/primitives/primitives";
import type { Wildcard } from "@/internal/wildcard";
import type { Maybe } from "@/functional/maybe";

// ---------------------------------------------------------------------------
// Render refs — stored on view.renderRef
// ---------------------------------------------------------------------------

type PrimitiveDomRef = {
  kind: "primitive";
  element: HTMLElement | Text;
  prevProps: Record<string, unknown> | null;
  listeners: Map<string, EventListener> | null;
};

type CompositeDomRef = {
  kind: "composite";
  endComment: Comment;
};

type DomRef = PrimitiveDomRef | CompositeDomRef;

// ---------------------------------------------------------------------------
// Creo event name → DOM event name
// ---------------------------------------------------------------------------

const DOM_EVENT: Record<string, string> = {
  click: "click",
  dblclick: "dblclick",
  pointerDown: "pointerdown",
  pointerUp: "pointerup",
  pointerMove: "pointermove",
  input: "input",
  change: "change",
  keyDown: "keydown",
  keyUp: "keyup",
  focus: "focus",
  blur: "blur",
};

// Props that are framework-internal, not HTML attributes
const SKIP_PROPS = new Set(["key", "content"]);

// DOM properties that must be set directly (not via setAttribute)
const DOM_PROPERTIES = new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
]);

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

export class HtmlRender implements IRender<HTMLElement | Text> {
  private primitives = new PrimitiveRegistry<HTMLElement | Text>();

  constructor(private container: HTMLElement) {
    this.registerBuiltins();
  }

  // -- IRender ----------------------------------------------------------------

  render(view: View): void {
    const ref = view.renderRef as Maybe<DomRef>;

    if (!ref) {
      // --- Mount: create DOM and insert ---
      const node = this.buildDom(view);
      const parent = view.parent;
      if (!parent) {
        this.container.appendChild(node);
      } else {
        const parentNode = this.getParentDomNode(parent);
        if (parentNode) {
          parentNode.insertBefore(
            node,
            this.findInsertionPoint(parent, view),
          );
        }
      }
      // Handle autofocus
      const newRef = view.renderRef as Maybe<DomRef>;
      if (
        newRef?.kind === "primitive" &&
        newRef.element instanceof HTMLElement &&
        (view.props as Record<string, unknown>).autofocus
      ) {
        newRef.element.focus();
      }
      return;
    }

    // --- Update: reposition + diff ---

    // Ensure DOM position is correct (handles keyed reordering)
    if (view.parent) {
      const insertBefore = this.findInsertionPoint(view.parent, view);
      if (ref.kind === "primitive") {
        if (ref.element.nextSibling !== insertBefore) {
          this.getParentDomNode(view.parent)?.insertBefore(
            ref.element,
            insertBefore,
          );
        }
      } else if (ref.endComment.nextSibling !== insertBefore) {
        const parentNode = this.getParentDomNode(view.parent);
        if (parentNode) {
          for (const child of view.virtualDom) {
            this.moveDomNodes(child, parentNode, insertBefore);
          }
          parentNode.insertBefore(ref.endComment, insertBefore);
        }
      }
    }

    // Diff attributes for primitives
    if (ref.kind !== "primitive") return;
    const nextProps = view.props as Record<string, unknown>;
    if (!ref.prevProps) {
      if (ref.element instanceof Text) {
        ref.element.textContent = String(nextProps.content);
      } else {
        this.setAttributes(ref, ref.element, nextProps);
      }
    } else if (ref.element instanceof Text) {
      if (ref.prevProps.content !== nextProps.content) {
        ref.element.textContent = String(nextProps.content);
      }
    } else {
      this.diffAttributes(ref, ref.element, ref.prevProps, nextProps);
    }
    ref.prevProps = { ...nextProps };
  }

  unmount(view: View): void {
    this.removeDomNodes(view);
    view.renderRef = undefined;
  }

  registerPrimitive(
    entries: [PrimitiveComponent<any, any>, PrimitiveRenderHandler<HTMLElement | Text>][],
  ): void {
    this.primitives.register(entries);
  }

  // -- Internal: DOM building -------------------------------------------------

  private buildDom(view: View): Node {
    // Check htmlTag first — most common case (80K hits vs 20K for primitiveRegistry)
    const tag = getHtmlTag(view.viewFn);
    if (tag) {
      const element = document.createElement(tag);
      const props = view.props as Record<string, unknown>;
      const ref: PrimitiveDomRef = {
        kind: "primitive",
        element,
        prevProps: null,
        listeners: null,
      };
      view.renderRef = ref;
      this.setAttributes(ref, element, props);
      return element;
    }

    const handler = this.primitives.getHandler(view.viewFn);
    if (handler) {
      const element = handler.render(view);
      const props = view.props as Record<string, unknown>;
      const ref: PrimitiveDomRef = {
        kind: "primitive",
        element,
        prevProps: null,
        listeners: null,
      };
      view.renderRef = ref;
      if (element instanceof HTMLElement) {
        this.setAttributes(ref, element, props);
      }
      return element;
    }

    const endComment = document.createComment("");

    view.renderRef = {
      kind: "composite",
      endComment,
    } as CompositeDomRef;

    return endComment;
  }

  // -- Internal: built-in primitives ------------------------------------------

  private registerBuiltins() {
    this.registerPrimitive([
      [text, { render: (view) => document.createTextNode(view.props.content) }],
    ]);
  }

  // -- Internal: attributes + events ------------------------------------------

  private isEventProp(key: string, value: unknown): boolean {
    return key.length > 2 && key[0] === "o" && key[1] === "n" &&
      key[2]! >= "A" && key[2]! <= "Z" &&
      typeof value === "function";
  }

  private eventPropToCreoName(prop: string): string {
    return prop[2]!.toLowerCase() + prop.slice(3);
  }

  private setAttributes(
    ref: PrimitiveDomRef,
    element: HTMLElement,
    props: Record<string, unknown>,
  ) {
    for (const key in props) {
      const value = props[key];
      if (SKIP_PROPS.has(key) || value == null) continue;
      if (this.isEventProp(key, value)) {
        this.bindEvent(ref, element, key, value as Function);
        continue;
      }
      this.setAttribute(element, key, value);
    }
  }

  private diffAttributes(
    ref: PrimitiveDomRef,
    element: HTMLElement,
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
  ) {
    // Remove attrs/events that existed before but are gone or null now
    for (const key of Object.keys(prev)) {
      if (SKIP_PROPS.has(key)) continue;
      if (!(key in next) || next[key] == null) {
        if (this.isEventProp(key, prev[key])) {
          this.unbindEvent(ref, element, key);
        } else {
          this.removeAttribute(element, key);
        }
      }
    }

    // Set attrs/events that are new or changed
    for (const key in next) {
      const value = next[key];
      if (SKIP_PROPS.has(key) || value == null) continue;
      if (prev[key] === value) continue;
      if (this.isEventProp(key, value)) {
        this.unbindEvent(ref, element, key);
        this.bindEvent(ref, element, key, value as Function);
      } else {
        this.setAttribute(element, key, value);
      }
    }
  }

  private bindEvent(
    ref: PrimitiveDomRef,
    element: HTMLElement,
    prop: string,
    handler: Function,
  ) {
    const creoEvent = this.eventPropToCreoName(prop);
    const domEvent = DOM_EVENT[creoEvent] ?? creoEvent.toLowerCase();
    const wrapped: EventListener = (e: Event) => {
      const data = this.mapEventData(creoEvent, e) as Record<string, unknown>;
      data.stopPropagation = () => e.stopPropagation();
      data.preventDefault = () => e.preventDefault();
      handler(data);
    };
    if (!ref.listeners) ref.listeners = new Map();
    ref.listeners.set(prop, wrapped);
    element.addEventListener(domEvent, wrapped);
  }

  private unbindEvent(
    ref: PrimitiveDomRef,
    element: HTMLElement,
    prop: string,
  ) {
    const wrapped = ref.listeners?.get(prop);
    if (!wrapped) return;
    const creoEvent = this.eventPropToCreoName(prop);
    const domEvent = DOM_EVENT[creoEvent] ?? creoEvent.toLowerCase();
    element.removeEventListener(domEvent, wrapped);
    ref.listeners!.delete(prop);
  }

  private mapEventData(creoEvent: string, e: Event): unknown {
    if (
      creoEvent === "click" ||
      creoEvent === "dblclick" ||
      creoEvent.startsWith("pointer")
    ) {
      const pe = e as PointerEvent;
      return { x: pe.clientX, y: pe.clientY };
    }
    if (creoEvent === "input" || creoEvent === "change") {
      return { value: (e.target as HTMLInputElement).value };
    }
    if (creoEvent.startsWith("key")) {
      const ke = e as KeyboardEvent;
      return { key: ke.key, code: ke.code };
    }
    return {};
  }

  private setAttribute(element: HTMLElement, key: string, value: unknown) {
    if (key === "class") {
      element.className = String(value);
    } else if (key === "style") {
      element.style.cssText = String(value);
    } else if (DOM_PROPERTIES.has(key)) {
      (element as Wildcard)[key] = value;
    } else if (typeof value === "boolean") {
      if (value) {
        element.setAttribute(key, "");
      } else {
        element.removeAttribute(key);
      }
    } else {
      element.setAttribute(key, String(value));
    }
  }

  private removeAttribute(element: HTMLElement, key: string) {
    if (key === "class") {
      element.className = "";
    } else if (key === "style") {
      element.style.cssText = "";
    } else if (DOM_PROPERTIES.has(key)) {
      (element as Wildcard)[key] = key === "value" ? "" : false;
    } else {
      element.removeAttribute(key);
    }
  }

  // -- Internal: DOM navigation -----------------------------------------------

  private findInsertionPoint(parent: View, view: View): Node | null {
    const nextSibling = view.getNextSibling();
    if (nextSibling) {
      return this.getFirstDomNode(nextSibling);
    }

    const ref = parent.renderRef as Maybe<DomRef>;
    if (!ref) return null;

    if (ref.kind === "composite") {
      return ref.endComment;
    }
    return null;
  }

  private getParentDomNode(parent: View): Node | null {
    const ref = parent.renderRef as Maybe<DomRef>;
    if (!ref) return null;

    if (ref.kind === "primitive") {
      return ref.element;
    }
    return ref.endComment.parentNode;
  }

  private moveDomNodes(
    view: View,
    parentNode: Node,
    insertBefore: Node | null,
  ): void {
    const ref = view.renderRef as Maybe<DomRef>;
    if (!ref) return;
    if (ref.kind === "primitive") {
      parentNode.insertBefore(ref.element, insertBefore);
    } else {
      for (const child of view.virtualDom) {
        this.moveDomNodes(child, parentNode, insertBefore);
      }
      parentNode.insertBefore(ref.endComment, insertBefore);
    }
  }

  private getFirstDomNode(view: View): Node | null {
    const ref = view.renderRef as Maybe<DomRef>;
    if (!ref) return null;
    if (ref.kind === "primitive") return ref.element;
    // Composite: first child's DOM node, or endComment if no children
    for (const child of view.virtualDom) {
      const node = this.getFirstDomNode(child);
      if (node) return node;
    }
    return ref.endComment;
  }

  private removeDomNodes(view: View) {
    const ref = view.renderRef as Maybe<DomRef>;
    if (!ref) return;

    if (ref.kind === "primitive") {
      ref.element.parentNode?.removeChild(ref.element);
      return;
    }

    ref.endComment.parentNode?.removeChild(ref.endComment);
  }
}
