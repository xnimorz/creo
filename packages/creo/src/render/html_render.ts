import type { ViewRecord } from "@/internal/internal_view";
import { F_PRIMITIVE, F_MOVED, F_TEXT_CONTENT } from "@/internal/internal_view";
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
  element: Element | Text;
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
  // Pointer / mouse — bubble.
  Click: "click",
  Dblclick: "dblclick",
  PointerDown: "pointerdown",
  PointerUp: "pointerup",
  PointerMove: "pointermove",
  // Form — bubble.
  Input: "input",
  Change: "change",
  // Keyboard — bubble.
  KeyDown: "keydown",
  KeyUp: "keyup",
  // Focus / blur — don't bubble (capture-phase delegation).
  Focus: "focus",
  Blur: "blur",
  // Hover — don't bubble; per-target only (no ancestor walk).
  MouseEnter: "mouseenter",
  MouseLeave: "mouseleave",
  PointerEnter: "pointerenter",
  PointerLeave: "pointerleave",
  // Scroll / load / error — don't bubble.
  Scroll: "scroll",
  Load: "load",
  Error: "error",
  // Disclosure — don't bubble.
  Toggle: "toggle",
  // Media — don't bubble (capture-phase delegation).
  VolumeChange: "volumechange",
  Play: "play",
  Pause: "pause",
  Ended: "ended",
  TimeUpdate: "timeupdate",
  LoadedMetadata: "loadedmetadata",
  LoadedData: "loadeddata",
  CanPlay: "canplay",
  CanPlayThrough: "canplaythrough",
  DurationChange: "durationchange",
  RateChange: "ratechange",
  Seeking: "seeking",
  Seeked: "seeked",
  Stalled: "stalled",
  Waiting: "waiting",
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
        const noWalk = NO_WALK_EVENTS.has(domEvent);
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
          // For mouseenter/leave-style events the browser already dispatches
          // one event per ancestor newly entered — walking up here would
          // double-fire ancestor handlers.
          if (noWalk) return;
          dom = dom.parentElement as typeof dom;
        }
      },
    };
    containerState.set(container, state);
  }
  return state;
}

// Events that don't bubble — register in the capture phase so delegation
// at the container still receives them.
const CAPTURE_EVENTS = new Set([
  "focus",
  "blur",
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
  "scroll",
  "load",
  "error",
  "toggle",
  "volumechange",
  "play",
  "pause",
  "ended",
  "timeupdate",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "durationchange",
  "ratechange",
  "seeking",
  "seeked",
  "stalled",
  "waiting",
]);

// Events whose semantics are "this element specifically" — the browser
// dispatches one event per ancestor newly entered, so walking up the tree
// from target to container would double-fire ancestor handlers. For these,
// only consult the actual target element.
const NO_WALK_EVENTS = new Set([
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
]);

// Events fired at high frequency where we want passive listeners by default.
const PASSIVE_EVENTS = new Set(["scroll"]);

function listenerOptions(domEvent: string): boolean | AddEventListenerOptions {
  const capture = CAPTURE_EVENTS.has(domEvent);
  if (PASSIVE_EVENTS.has(domEvent)) {
    return { capture, passive: true };
  }
  return capture;
}

function ensureDelegated(container: HTMLElement, domEvent: string): void {
  const state = getState(container);
  const count = state.counts.get(domEvent) ?? 0;
  if (count === 0) {
    container.addEventListener(
      domEvent,
      state.handler,
      listenerOptions(domEvent),
    );
  }
  state.counts.set(domEvent, count + 1);
}

function removeDelegated(container: HTMLElement, domEvent: string): void {
  const state = getState(container);
  const count = state.counts.get(domEvent) ?? 0;
  if (count <= 1) {
    state.counts.delete(domEvent);
    container.removeEventListener(
      domEvent,
      state.handler,
      listenerOptions(domEvent),
    );
  } else {
    state.counts.set(domEvent, count - 1);
  }
}

const POINTER_EVENTS = new Set([
  "click",
  "dblclick",
  "pointerdown",
  "pointerup",
  "pointermove",
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
]);

const MEDIA_EVENTS = new Set([
  "volumechange",
  "play",
  "pause",
  "ended",
  "timeupdate",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "durationchange",
  "ratechange",
  "seeking",
  "seeked",
  "stalled",
  "waiting",
]);

function mapEventData(domEvent: string, e: Event): Record<string, unknown> {
  let data: Record<string, unknown>;
  if (POINTER_EVENTS.has(domEvent)) {
    const pe = e as PointerEvent;
    data = { x: pe.clientX, y: pe.clientY };
  } else if (domEvent === "input" || domEvent === "change") {
    const target = e.target as HTMLInputElement;
    data = { value: target.value, checked: !!target.checked };
  } else if (MEDIA_EVENTS.has(domEvent)) {
    const target = e.target as HTMLMediaElement;
    data = {
      muted: !!target.muted,
      paused: !!target.paused,
      volume: target.volume,
      currentTime: target.currentTime,
      duration: Number.isFinite(target.duration) ? target.duration : 0,
    };
  } else if (domEvent === "scroll") {
    const target = e.target as Element;
    data = {
      scrollTop: (target as HTMLElement).scrollTop ?? 0,
      scrollLeft: (target as HTMLElement).scrollLeft ?? 0,
    };
  } else if (domEvent === "error") {
    const ev = e as ErrorEvent;
    data = { message: ev.message ?? "" };
  } else if (domEvent === "toggle") {
    const target = e.target as HTMLDetailsElement;
    data = { open: !!target.open };
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

const SVG_NS = "http://www.w3.org/2000/svg";

const DOM_PROPERTIES = new Set([
  "value",
  "checked",
  "selected",
  "indeterminate",
  "muted",
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
          const parentIsSvg = (parentNode as Element).namespaceURI === SVG_NS;
          const useSvg = tag === "svg" || parentIsSvg;
          const element = useSvg
            ? document.createElementNS(SVG_NS, tag)
            : document.createElement(tag);
          const props = view.props as Record<string, unknown>;
          const domRef: PrimitiveDomRef = { element, prevProps: null };
          view.renderRef = domRef;
          this.setAttributes(element, props);
          domRef.prevProps = props;

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

          // The HTML `autofocus` attribute only fires during initial document
          // parse — for dynamically inserted elements browsers ignore it.
          // Match React's behaviour by calling .focus() once after mount.
          if (
            props != null &&
            (props as Record<string, unknown>).autofocus === true &&
            typeof (element as HTMLElement).focus === "function"
          ) {
            (element as HTMLElement).focus();
          }
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
      const parentEl = ref.element as Element;
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
    const el = ref.element as Element;
    if (!ref.prevProps) {
      this.setAttributes(el, nextProps);
    } else if (ref.prevProps !== nextProps) {
      this.diffAttributes(el, ref.prevProps, nextProps);
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
        if (ref && !(ref.element instanceof Text)) return ref.element;
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

    // view.pos is maintained by the reconciler — avoid the O(n) indexOf scan.
    // Fall back to indexOf if pos is unset (-1) or stale (defensive).
    let idx = view.pos;
    if (idx < 0 || children[idx] !== view) idx = children.indexOf(view);
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

  private setAttributes(element: Element, props: Record<string, unknown>) {
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
    element: Element,
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
      // Re-assert DOM properties even if prevProps matches: the live DOM
      // value can drift from prevProps via user input (typing in an input,
      // toggling a checkbox) without our state ever changing.
      if (prev[key] === value && !DOM_PROPERTIES.has(key)) continue;
      if (isEventProp(key)) {
        const creoName = key.slice(2);
        const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
        const evObj = (element as any)[$EV] as
          | Record<string, Function>
          | undefined;
        if (evObj && domEvent in evObj) {
          evObj[domEvent] = value as Function;
        } else {
          this.bindEvent(element, key, value as Function);
        }
      } else {
        this.setAttribute(element, key, value);
      }
    }
  }

  private bindEvent(element: Element, prop: string, handler: Function): void {
    const creoName = prop.slice(2);
    const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
    const evObj: Record<string, Function> =
      (element as any)[$EV] ?? ((element as any)[$EV] = {});
    evObj[domEvent] = handler;
    ensureDelegated(this.container, domEvent);
  }

  private unbindEvent(element: Element, prop: string): void {
    const creoName = prop.slice(2);
    const domEvent = DOM_EVENT[creoName] ?? creoName.toLowerCase();
    const evObj = (element as any)[$EV] as Record<string, Function> | undefined;
    if (evObj) {
      delete evObj[domEvent];
    }
    removeDelegated(this.container, domEvent);
  }

  private setAttribute(element: Element, key: string, value: unknown) {
    if (key === "class") {
      // className is a settable string on HTMLElement but readonly (SVGAnimatedString)
      // on SVG — use setAttribute which works for both.
      element.setAttribute("class", String(value));
    } else if (key === "style") {
      (element as HTMLElement).style.cssText = String(value);
    } else if (DOM_PROPERTIES.has(key)) {
      (element as Wildcard)[key] = value;
    } else if (typeof value === "boolean") {
      if (value) element.setAttribute(key, "");
      else element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(value));
    }
  }

  private removeAttribute(element: Element, key: string) {
    if (key === "class") {
      element.removeAttribute("class");
    } else if (key === "style") {
      (element as HTMLElement).style.cssText = "";
    } else if (DOM_PROPERTIES.has(key)) {
      (element as Wildcard)[key] = key === "value" ? "" : false;
    } else {
      element.removeAttribute(key);
    }
  }

  // -- Internal: DOM navigation -----------------------------------------------

  private getFirstDomNode(view: ViewRecord): Node | null {
    if (!view.renderRef) return null;
    if (view.flags & F_PRIMITIVE)
      return (view.renderRef as PrimitiveDomRef).element;
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
      parentNode.insertBefore(
        (view.renderRef as PrimitiveDomRef).element,
        insertBefore,
      );
    } else if (view.children) {
      for (const child of view.children) {
        this.moveDomNodes(child, parentNode, insertBefore);
      }
    }
  }

  private removeDomNodes(view: ViewRecord) {
    const ref = view.renderRef as Maybe<PrimitiveDomRef>;
    if (!ref || !(view.flags & F_PRIMITIVE)) return;
    // F_TEXT_CONTENT: ref.element is the PARENT's element (optimization),
    // not this text view's own node. Clear the parent's textContent so
    // incoming siblings mount into an empty host, but never remove the
    // parent — the parent owns its own lifecycle.
    if (view.flags & F_TEXT_CONTENT) {
      (ref.element as Element).textContent = "";
      return;
    }
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
