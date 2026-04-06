import type { ViewRecord } from "@/internal/internal_view";
import {
  F_PRIMITIVE,
  F_MOVED,
  F_TEXT_CONTENT,
} from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import type { Wildcard } from "@/internal/wildcard";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

// ---------------------------------------------------------------------------
// Render refs — stored on view.renderRef
// ---------------------------------------------------------------------------

/**
 * For primitives: { element, prevProps }
 * For composites: renderRef is set to `true` (just a non-null marker)
 *
 * Discriminated via view.flags & F_PRIMITIVE — no `kind` field needed.
 */
type PrimitiveDomRef = {
  element: HTMLElement | Text;
  prevProps: Maybe<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// Event delegation — Inferno-style: one listener per event type on container
// ---------------------------------------------------------------------------

function isEventProp(key: string): boolean {
  return (
    key.charCodeAt(0) === 111 && // 'o'
    key.charCodeAt(1) === 110 && // 'n'
    key.charCodeAt(2) >= 65 && // 'A'
    key.charCodeAt(2) <= 90 // 'Z'
  );
}

const DOM_EVENT: Record<string, string> = {
  Click: "click",
  Dblclick: "dblclick",
  PointerDown: "pointerdown",
  PointerUp: "pointerup",
  PointerMove: "pointermove",
  Input: "input",
  Change: "change",
  KeyDown: "keydown",
  KeyUp: "keyup",
  Focus: "focus",
  Blur: "blur",
};

const $EV = Symbol.for("creo.ev");

const containerState = new WeakMap<
  HTMLElement,
  {
    counts: Map<string, number>;
    handler: (e: Event) => void;
  }
>();

function getState(container: HTMLElement) {
  let state = containerState.get(container);
  if (!state) {
    state = {
      counts: new Map(),
      handler(e: Event) {
        const domEvent = e.type;
        let dom = e.target as
          | (HTMLElement & { [$EV]?: Record<string, Function> })
          | null;
        while (dom && dom !== container) {
          const evObj = dom[$EV];
          if (evObj) {
            const handler = evObj[domEvent];
            if (handler) {
              handler(mapEventData(domEvent, e));
              if (e.cancelBubble) return;
            }
          }
          dom = dom.parentElement as typeof dom;
        }
      },
    };
    containerState.set(container, state);
  }
  return state;
}

function ensureDelegated(container: HTMLElement, domEvent: string): void {
  const state = getState(container);
  const count = state.counts.get(domEvent) ?? 0;
  if (count === 0) {
    container.addEventListener(domEvent, state.handler);
  }
  state.counts.set(domEvent, count + 1);
}

function removeDelegated(container: HTMLElement, domEvent: string): void {
  const state = getState(container);
  const count = state.counts.get(domEvent) ?? 0;
  if (count <= 1) {
    state.counts.delete(domEvent);
    container.removeEventListener(domEvent, state.handler);
  } else {
    state.counts.set(domEvent, count - 1);
  }
}

function mapEventData(domEvent: string, e: Event): Record<string, unknown> {
  let data: Record<string, unknown>;
  if (
    domEvent === "click" ||
    domEvent === "dblclick" ||
    domEvent === "pointerdown" ||
    domEvent === "pointerup" ||
    domEvent === "pointermove"
  ) {
    const pe = e as PointerEvent;
    data = { x: pe.clientX, y: pe.clientY };
  } else if (domEvent === "input" || domEvent === "change") {
    data = { value: (e.target as HTMLInputElement).value };
  } else if (domEvent === "keydown" || domEvent === "keyup") {
    const ke = e as KeyboardEvent;
    data = { key: ke.key, code: ke.code };
  } else {
    data = {};
  }
  data.stopPropagation = () => e.stopPropagation();
  data.preventDefault = () => e.preventDefault();
  return data;
}

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
  engine!: Engine;

  constructor(private container: HTMLElement) {}

  // -- IRender ----------------------------------------------------------------

  render(view: ViewRecord): void {
    if (!view.renderRef) {
      // --- Mount ---
      if (view.flags & F_PRIMITIVE) {
        const parentNode = this.findParentDom(view);
        const refNode = this.findInsertionPoint(view);
        const tag = view.viewFn[$primitive]!;

        if (tag === "text") {
          const textNode = document.createTextNode(String(view.props));
          view.renderRef = { element: textNode, prevProps: null };
          parentNode.insertBefore(textNode, refNode);
        } else {
          const element = document.createElement(tag);
          const props = view.props as Record<string, unknown>;
          const domRef: PrimitiveDomRef = { element, prevProps: null };
          view.renderRef = domRef;
          this.setAttributes(element, props);

          // If single text child, use textContent directly
          if (view.children?.length === 1) {
            const child = view.children[0]!;
            if (
              child.flags & F_PRIMITIVE &&
              child.viewFn[$primitive] === "text"
            ) {
              element.textContent = String(child.props);
              child.renderRef = { element, prevProps: null };
              child.flags |= F_TEXT_CONTENT;
            }
          }

          parentNode.insertBefore(element, refNode);
        }
      } else {
        // Composite: no DOM — just mark as mounted
        view.renderRef = true;
      }
      return;
    }

    // --- Update ---

    if (view.flags & F_MOVED) {
      const parentNode = this.findParentDom(view);
      const refNode = this.findInsertionPoint(view);
      if (view.flags & F_PRIMITIVE) {
        const ref = view.renderRef as PrimitiveDomRef;
        parentNode.insertBefore(ref.element, refNode);
      } else {
        this.moveDomNodes(view, parentNode, refNode);
      }
    }

    if (!(view.flags & F_PRIMITIVE)) return;

    const ref = view.renderRef as PrimitiveDomRef;

    // Text node in textContent mode — update parent's textContent
    if (view.flags & F_TEXT_CONTENT) {
      const parentEl = ref.element as HTMLElement;
      const nextText = String(view.props);
      if (parentEl.textContent !== nextText) {
        parentEl.textContent = nextText;
      }
      return;
    }

    if (ref.element instanceof Text) {
      const nextText = String(view.props);
      if (ref.element.textContent !== nextText) {
        ref.element.textContent = nextText;
      }
      return;
    }

    const nextProps = view.props as Record<string, unknown>;
    if (!ref.prevProps) {
      this.setAttributes(ref.element, nextProps);
    } else if (ref.prevProps !== nextProps) {
      this.diffAttributes(ref.element, ref.prevProps, nextProps);
    }
    ref.prevProps = nextProps;
  }

  unmount(view: ViewRecord): void {
    if (view.flags & F_PRIMITIVE) {
      this.removeDomNodes(view);
    }
    view.renderRef = undefined;
  }

  // -- Internal: DOM tree navigation ------------------------------------------

  private findParentDom(view: ViewRecord): Node {
    let parent = view.parent;
    while (parent) {
      if (parent.flags & F_PRIMITIVE) {
        const ref = parent.renderRef as Maybe<PrimitiveDomRef>;
        if (ref && ref.element instanceof HTMLElement) return ref.element;
      }
      parent = parent.parent;
    }
    return this.container;
  }

  private findInsertionPoint(view: ViewRecord): Node | null {
    const parent = view.parent;
    if (!parent?.children) return null;

    const children = parent.children;

    // Fast path: last child
    if (children[children.length - 1] === view) {
      return this.#parentEndAnchor(parent);
    }

    const idx = children.indexOf(view);
    for (let i = idx + 1; i < children.length; i++) {
      const dom = this.getFirstDomNode(children[i]!);
      if (dom) return dom;
    }

    return this.#parentEndAnchor(parent);
  }

  #parentEndAnchor(parent: ViewRecord): Node | null {
    if (parent.flags & F_PRIMITIVE) return null; // append to element
    // Composite: walk up
    return this.findInsertionPoint(parent);
  }

  // -- Internal: attributes + delegated events --------------------------------

  private setAttributes(
    element: HTMLElement,
    props: Record<string, unknown>,
  ) {
    for (const key in props) {
      const value = props[key];
      if (key === "key" || value == null) continue;
      if (isEventProp(key)) {
        this.bindEvent(element, key, value as Function);
        continue;
      }
      this.setAttribute(element, key, value);
    }
  }

  private diffAttributes(
    element: HTMLElement,
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
  ) {
    for (const key in prev) {
      if (key === "key") continue;
      if (!(key in next) || next[key] == null) {
        if (isEventProp(key)) {
          this.unbindEvent(element, key);
        } else {
          this.removeAttribute(element, key);
        }
      }
    }

    for (const key in next) {
      const value = next[key];
      if (key === "key" || value == null) continue;
      if (prev[key] === value) continue;
      if (isEventProp(key)) {
        const creoName = key.slice(2);
        const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
        const evObj = (element as any)[$EV] as
          | Record<string, Function>
          | undefined;
        if (evObj) {
          evObj[domEvent] = value as Function;
        } else {
          this.bindEvent(element, key, value as Function);
        }
      } else {
        this.setAttribute(element, key, value);
      }
    }
  }

  private bindEvent(
    element: HTMLElement,
    prop: string,
    handler: Function,
  ): void {
    const creoName = prop.slice(2);
    const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
    const evObj: Record<string, Function> =
      (element as any)[$EV] ?? ((element as any)[$EV] = {});
    evObj[domEvent] = handler;
    ensureDelegated(this.container, domEvent);
  }

  private unbindEvent(element: HTMLElement, prop: string): void {
    const creoName = prop.slice(2);
    const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
    const evObj = (element as any)[$EV] as Record<string, Function> | undefined;
    if (evObj) {
      delete evObj[domEvent];
    }
    removeDelegated(this.container, domEvent);
  }

  private setAttribute(element: HTMLElement, key: string, value: unknown) {
    if (key === "class") {
      element.className = String(value);
    } else if (key === "style") {
      element.style.cssText = String(value);
    } else if (DOM_PROPERTIES.has(key)) {
      (element as Wildcard)[key] = value;
    } else if (typeof value === "boolean") {
      if (value) element.setAttribute(key, "");
      else element.removeAttribute(key);
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

  private getFirstDomNode(view: ViewRecord): Node | null {
    if (!view.renderRef) return null;
    if (view.flags & F_PRIMITIVE) return (view.renderRef as PrimitiveDomRef).element;
    if (view.children) {
      for (const child of view.children) {
        const dom = this.getFirstDomNode(child);
        if (dom) return dom;
      }
    }
    return null;
  }

  private moveDomNodes(
    view: ViewRecord,
    parentNode: Node,
    insertBefore: Node | null,
  ): void {
    if (!view.renderRef) return;
    if (view.flags & F_PRIMITIVE) {
      parentNode.insertBefore((view.renderRef as PrimitiveDomRef).element, insertBefore);
    } else if (view.children) {
      for (const child of view.children) {
        this.moveDomNodes(child, parentNode, insertBefore);
      }
    }
  }

  private removeDomNodes(view: ViewRecord) {
    const ref = view.renderRef as Maybe<PrimitiveDomRef>;
    if (!ref || !(view.flags & F_PRIMITIVE)) return;
    const evObj = (ref.element as any)[$EV] as
      | Record<string, Function>
      | undefined;
    if (evObj) {
      for (const domEvent in evObj) {
        removeDelegated(this.container, domEvent);
      }
      delete (ref.element as any)[$EV];
    }
    ref.element.parentNode?.removeChild(ref.element);
  }
}
