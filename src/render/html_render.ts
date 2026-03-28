import type { View } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
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
const SKIP_PROPS = new Set(["key"]);

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
  constructor(private container: HTMLElement) {}

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
          parentNode.insertBefore(node, this.findInsertionPoint(parent, view));
        }
      }
      // Handle autofocus
      const newRef = view.renderRef as Maybe<DomRef>;
      if (
        newRef?.kind === "primitive" &&
        newRef.element instanceof HTMLElement &&
        (view.props as Record<string, unknown>)?.autofocus
      ) {
        newRef.element.focus();
      }
      return;
    }

    // --- Update: reposition + diff ---

    if (view.parent) {
      const expectedStart = this.findInsertionPoint(view.parent, view);
      const firstDom = this.getFirstDomNode(view);

      if (firstDom && firstDom !== expectedStart) {
        const parentNode = this.getParentDomNode(view.parent);
        if (parentNode) {
          if (ref.kind === "primitive") {
            parentNode.insertBefore(ref.element, expectedStart);
          } else {
            if (view.virtualDom) {
              for (const child of view.virtualDom) {
                this.moveDomNodes(child, parentNode, expectedStart);
              }
            }
            parentNode.insertBefore(ref.endComment, expectedStart);
          }
        }
      }
    }

    // Diff attributes for primitives
    if (ref.kind !== "primitive") return;
    if (ref.element instanceof Text) {
      const nextText = String(view.props);
      if (ref.element.textContent !== nextText) {
        ref.element.textContent = nextText;
      }
      return;
    }
    const nextProps = view.props as Record<string, unknown>;
    if (!ref.prevProps) {
      this.setAttributes(ref, ref.element, nextProps);
    } else {
      this.diffAttributes(ref, ref.element, ref.prevProps, nextProps);
    }
    ref.prevProps = { ...nextProps };
  }

  unmount(view: View): void {
    this.removeDomNodes(view);
    view.renderRef = undefined;
  }

  // -- Internal: DOM building -------------------------------------------------

  private buildDom(view: View): Node {
    const tag = view.viewFn[$primitive];

    if (tag != null) {
      if (tag === "text") {
        const textNode = document.createTextNode(String(view.props));
        const ref: PrimitiveDomRef = {
          kind: "primitive",
          element: textNode,
          prevProps: null,
          listeners: null,
        };
        view.renderRef = ref;
        return textNode;
      }

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

    const endComment = document.createComment("");
    view.renderRef = {
      kind: "composite",
      endComment,
    } as CompositeDomRef;

    return endComment;
  }

  // -- Internal: attributes + events ------------------------------------------

  private isEventProp(key: string, value: unknown): boolean {
    return (
      key.length > 2 &&
      key[0] === "o" &&
      key[1] === "n" &&
      key[2]! >= "A" &&
      key[2]! <= "Z" &&
      typeof value === "function"
    );
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
    const vdom = parent.virtualDom;
    if (vdom) {
      let prev = vdom.getNode(view)?.getPrev();
      while (prev) {
        const prevRef = prev.v.renderRef as Maybe<DomRef>;
        if (prevRef) {
          const lastDom =
            prevRef.kind === "composite" ? prevRef.endComment : prevRef.element;
          return lastDom.nextSibling;
        }
        prev = prev.getPrev();
      }
    }

    // No rendered previous sibling — insert at the start of the parent
    const ref = parent.renderRef as Maybe<DomRef>;
    if (!ref) return null;

    if (ref.kind === "composite") {
      return ref.endComment;
    }

    // Primitive parent: insert before its first child (beginning of container)
    return ref.element.firstChild;
  }

  private getParentDomNode(parent: View): Maybe<Node> {
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
      if (view.virtualDom) {
        for (const child of view.virtualDom) {
          this.moveDomNodes(child, parentNode, insertBefore);
        }
      }
      parentNode.insertBefore(ref.endComment, insertBefore);
    }
  }

  private getFirstDomNode(view: View): Node | null {
    const ref = view.renderRef as Maybe<DomRef>;
    if (!ref) return null;
    if (ref.kind === "primitive") return ref.element;
    if (view.virtualDom) {
      for (const child of view.virtualDom) {
        const node = this.getFirstDomNode(child);
        if (node) return node;
      }
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
