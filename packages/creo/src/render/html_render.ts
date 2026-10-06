import type { ViewRecord } from "@/internal/internal_view";
import { F_PRIMITIVE, F_MOVED, F_TEXT_CONTENT } from "@/internal/internal_view";
import type { IRender } from "./render_interface";
import { $primitive } from "@/public/primitive";
import { applyRef, type Ref } from "@/public/view";
import type { Wildcard } from "@/internal/wildcard";
import type { Maybe } from "@/functional/maybe";
import type { Engine } from "@/internal/engine";

// ---------------------------------------------------------------------------
// Render refs — stored on view.renderRef
// ---------------------------------------------------------------------------

// Composites use `true` as a mounted marker
type PrimitiveDomRef = {
  element: Element | Text;
  prevProps: Maybe<Record<string, unknown>>;
};

// ---------------------------------------------------------------------------
// Event delegation
// ---------------------------------------------------------------------------

const $EV = Symbol.for("creo.ev");
// Set by stopPropagation() so the walk stops without reading `cancelBubble`
const $STOPPED = Symbol("creo.stopped");

type EventPayload = Record<string, unknown> & { [$STOPPED]?: boolean };

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
              const data = mapEventData(domEvent, e, dom);
              handler(data);
              if (data[$STOPPED]) return;
            }
          }
          if (noWalk) return;
          dom = dom.parentElement as typeof dom;
        }
      },
    };
    containerState.set(container, state);
  }
  return state;
}

// Non-bubbling: listen in capture phase
const CAPTURE_EVENTS = new Set([
  "focus",
  "blur",
  "pointerenter",
  "pointerleave",
  "scroll",
  "load",
  "error",
  "toggle",
  "beforetoggle",
  "invalid",
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

// Browser fires per ancestor already — walking up would double-fire
const NO_WALK_EVENTS = new Set(["pointerenter", "pointerleave"]);

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
  "pointercancel",
  "pointerenter",
  "pointerleave",
  "pointerover",
  "pointerout",
  "contextmenu",
]);

const DRAG_EVENTS = new Set([
  "dragstart",
  "dragend",
  "dragover",
  "dragenter",
  "dragleave",
  "drop",
]);

const CLIPBOARD_EVENTS = new Set(["copy", "cut", "paste"]);

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

function pointerPayload(
  pe: PointerEvent | MouseEvent | DragEvent | WheelEvent,
  e: Event,
  currentTarget: HTMLElement,
): Record<string, unknown> {
  const pointerId =
    typeof (pe as PointerEvent).pointerId === "number"
      ? (pe as PointerEvent).pointerId
      : -1;
  return {
    x: pe.clientX,
    y: pe.clientY,
    pointerId,
    pointerType:
      typeof (pe as PointerEvent).pointerType === "string"
        ? (pe as PointerEvent).pointerType
        : "",
    button: typeof pe.button === "number" ? pe.button : 0,
    buttons: typeof pe.buttons === "number" ? pe.buttons : 0,
    target: e.target as HTMLElement,
    currentTarget,
    capture: () => {
      if (pointerId >= 0 && currentTarget.setPointerCapture) {
        currentTarget.setPointerCapture(pointerId);
      }
    },
    release: () => {
      if (pointerId >= 0 && currentTarget.releasePointerCapture) {
        currentTarget.releasePointerCapture(pointerId);
      }
    },
    nativeEvent: e,
  };
}

function mapEventData(
  domEvent: string,
  e: Event,
  currentTarget: HTMLElement,
): EventPayload {
  let data: EventPayload;
  if (POINTER_EVENTS.has(domEvent)) {
    data = pointerPayload(e as PointerEvent, e, currentTarget);
  } else if (domEvent === "wheel") {
    const we = e as WheelEvent;
    data = pointerPayload(we, e, currentTarget);
    data.deltaX = we.deltaX;
    data.deltaY = we.deltaY;
    data.deltaZ = we.deltaZ;
    data.deltaMode = we.deltaMode;
  } else if (DRAG_EVENTS.has(domEvent)) {
    const de = e as DragEvent;
    data = pointerPayload(de, e, currentTarget);
    data.dataTransfer = de.dataTransfer ?? null;
  } else if (CLIPBOARD_EVENTS.has(domEvent)) {
    const ce = e as ClipboardEvent;
    data = { clipboardData: ce.clipboardData ?? null };
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
  } else if (domEvent === "toggle" || domEvent === "beforetoggle") {
    const te = e as Event & { oldState?: string; newState?: string };
    const target = e.target as HTMLDetailsElement;
    data = {
      open: !!target.open,
      oldState: te.oldState ?? "",
      newState: te.newState ?? "",
    };
  } else if (domEvent === "submit") {
    const se = e as Event & { submitter?: Element | null };
    data = { submitter: (se.submitter as HTMLElement) ?? null };
  } else if (domEvent === "command") {
    // CommandEvent missing from some TS libs
    const ce = e as Event & { command?: string; source?: Element | null };
    data = {
      command: ce.command ?? "",
      source: (ce.source as HTMLElement) ?? (e.target as HTMLElement),
    };
  } else if (domEvent === "keydown" || domEvent === "keyup") {
    const ke = e as KeyboardEvent;
    data = { key: ke.key, code: ke.code };
  } else {
    data = {};
  }
  data.stopPropagation = () => {
    e.stopPropagation();
    data[$STOPPED] = true;
  };
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

// Only these can drift from props via user input
const STATEFUL_TAGS = new Set([
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "OPTION",
  "AUDIO",
  "VIDEO",
]);

// ---------------------------------------------------------------------------
// HTML Renderer
// ---------------------------------------------------------------------------

export class HtmlRender implements IRender<HTMLElement | Text> {
  engine!: Engine;

  #mountRoot: Maybe<ViewRecord> = null;
  #mountParent: Node | null = null;
  #mountAnchor: Node | null = null;
  // ref / autofocus deferred until endMount
  #mountPending: PrimitiveDomRef[] = [];

  constructor(private container: HTMLElement) {}

  // -- IRender ----------------------------------------------------------------

  beginMount(root: ViewRecord, anchor?: unknown): unknown {
    this.#mountRoot = root;
    this.#mountParent = this.findParentDom(root);
    this.#mountAnchor =
      anchor !== undefined
        ? (anchor as Node | null)
        : this.findInsertionPoint(root);
    return this.#mountAnchor;
  }

  // Post-order: append into detached parent; top-level nodes go before the anchor
  attach(view: ViewRecord): void {
    if (!(view.flags & F_PRIMITIVE) || view.flags & F_TEXT_CONTENT) return;
    const el = (view.renderRef as PrimitiveDomRef).element;
    const root = this.#mountRoot;
    let p = view;
    while (p !== root) {
      p = p.parent!;
      if (p.flags & F_PRIMITIVE) {
        (p.renderRef as PrimitiveDomRef).element.appendChild(el);
        return;
      }
    }
    this.#mountParent!.insertBefore(el, this.#mountAnchor);
  }

  endMount(_root: ViewRecord): void {
    this.#mountRoot = null;
    this.#mountParent = null;
    this.#mountAnchor = null;
    const pending = this.#mountPending;
    if (pending.length === 0) return;
    this.#mountPending = [];
    for (const ref of pending) {
      const element = ref.element as Element;
      const props = ref.prevProps!;
      // Browsers ignore `autofocus` on inserted elements
      if (
        props.autofocus === true &&
        typeof (element as HTMLElement).focus === "function"
      ) {
        (element as HTMLElement).focus();
      }
      applyRef((props as { ref?: Ref<Element> }).ref, element);
    }
  }

  render(view: ViewRecord): void {
    if (!view.renderRef) {
      // --- Mount (create only, attach() inserts) ---
      if (view.flags & F_PRIMITIVE) {
        const tag = view.viewFn[$primitive]!;

        if (tag === "text") {
          const textNode = document.createTextNode(String(view.props));
          view.renderRef = { element: textNode, prevProps: null };
        } else {
          const useSvg =
            tag === "svg" ||
            (this.findParentDom(view) as Element).namespaceURI === SVG_NS;
          const element = useSvg
            ? document.createElementNS(SVG_NS, tag)
            : document.createElement(tag);
          const props = view.props as Record<string, unknown>;
          const domRef: PrimitiveDomRef = { element, prevProps: null };
          view.renderRef = domRef;
          this.setAttributes(element, props);
          domRef.prevProps = props;

          // Single text child → textContent
          if (view.children?.length === 1) {
            const child = view.children[0]!;
            if (
              child.flags & F_PRIMITIVE &&
              child.viewFn[$primitive] === "text"
            ) {
              element.textContent = String(child.props);
              child.renderRef = { element, prevProps: child.props };
              child.flags |= F_TEXT_CONTENT;
            }
          }

          if (props != null && (props.ref != null || props.autofocus === true)) {
            this.#mountPending.push(domRef);
          }
        }
      } else {
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

    if (view.flags & F_TEXT_CONTENT) {
      if (ref.prevProps === (view.props as never)) return;
      ref.prevProps = view.props as never;
      const parentEl = ref.element as Element;
      const nextText = String(view.props);
      if (parentEl.textContent !== nextText) {
        parentEl.textContent = nextText;
      }
      return;
    }

    if (ref.element instanceof Text) {
      if (ref.prevProps === (view.props as never)) return;
      ref.prevProps = view.props as never;
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

  /** True when a stateful DOM property differs from the live DOM. */
  shouldReassert(view: ViewRecord, nextProps: unknown): boolean {
    if (nextProps == null || typeof nextProps !== "object") return false;
    const ref = view.renderRef as Maybe<PrimitiveDomRef>;
    if (!ref || ref.element instanceof Text) return false;
    const el = ref.element as Wildcard;
    if (!STATEFUL_TAGS.has((el as Element).tagName)) return false;
    const props = nextProps as Record<string, unknown>;
    for (const key of DOM_PROPERTIES) {
      if (!(key in props)) continue;
      const live = el[key];
      const next = props[key];
      // Compare under the browser's coercion
      if (typeof next === "boolean" || typeof live === "boolean") {
        if (Boolean(live) !== Boolean(next)) return true;
      } else if (String(live) !== String(next)) {
        return true;
      }
    }
    return false;
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

    if (children[children.length - 1] === view) {
      return this.#parentEndAnchor(parent);
    }

    // indexOf only if pos is unset or stale
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
    return this.findInsertionPoint(parent);
  }

  // -- Internal: attributes + delegated events --------------------------------

  private setAttributes(element: Element, props: Record<string, unknown>) {
    if (props == null) return;
    for (const key in props) {
      const value = props[key];
      if (key === "key" || key === "ref" || key === "on" || value == null)
        continue;
      this.setAttribute(element, key, value);
    }
    const on = props.on as Maybe<Record<string, Function>>;
    if (on) {
      for (const ev in on) {
        const handler = on[ev];
        if (handler) this.bindEvent(element, ev, handler);
      }
    }
  }

  private diffAttributes(
    element: Element,
    prev: Maybe<Record<string, unknown>>,
    next: Maybe<Record<string, unknown>>,
  ) {
    if (prev) {
      for (const key in prev) {
        if (key === "key" || key === "ref" || key === "on") continue;
        if (next == null || !(key in next) || next[key] == null) {
          this.removeAttribute(element, key);
        }
      }
    }

    if (next) {
      for (const key in next) {
        const value = next[key];
        if (key === "key" || key === "ref" || key === "on" || value == null)
          continue;
        // DOM properties are re-asserted: user input can drift them from prevProps
        if (prev && prev[key] === value && !DOM_PROPERTIES.has(key)) continue;
        this.setAttribute(element, key, value);
      }
    }

    const prevOn = prev?.on as Maybe<Record<string, Function>>;
    const nextOn = next?.on as Maybe<Record<string, Function>>;
    if (prevOn !== nextOn) {
      this.diffEvents(element, prevOn, nextOn);
    }

    const prevRef = prev?.ref as Maybe<Ref<Element>>;
    const nextRef = next?.ref as Maybe<Ref<Element>>;
    if (prevRef !== nextRef) {
      applyRef(prevRef, null);
      applyRef(nextRef, element);
    }
  }

  private diffEvents(
    element: Element,
    prev: Maybe<Record<string, Function>>,
    next: Maybe<Record<string, Function>>,
  ) {
    if (prev) {
      for (const ev in prev) {
        if (!next || next[ev] == null) {
          this.unbindEvent(element, ev);
        }
      }
    }
    if (next) {
      for (const ev in next) {
        const value = next[ev];
        if (value == null) continue;
        if (prev && prev[ev] === value) continue;
        const domEvent = ev.toLowerCase();
        const evObj = (element as any)[$EV] as
          | Record<string, Function>
          | undefined;
        if (evObj && domEvent in evObj) {
          evObj[domEvent] = value;
        } else {
          this.bindEvent(element, ev, value);
        }
      }
    }
  }

  private bindEvent(
    element: Element,
    eventName: string,
    handler: Function,
  ): void {
    const domEvent = eventName.toLowerCase();
    const evObj: Record<string, Function> =
      (element as any)[$EV] ?? ((element as any)[$EV] = {});
    evObj[domEvent] = handler;
    ensureDelegated(this.container, domEvent);
  }

  private unbindEvent(element: Element, eventName: string): void {
    const domEvent = eventName.toLowerCase();
    const evObj = (element as any)[$EV] as Record<string, Function> | undefined;
    if (evObj) {
      delete evObj[domEvent];
    }
    removeDelegated(this.container, domEvent);
  }

  private setAttribute(element: Element, key: string, value: unknown) {
    if (key === "class") {
      // className is readonly on SVG
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
    // ref.element is the parent's element: clear text, never remove it
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
    // Before removal so the callback can still read layout
    const prevProps = ref.prevProps as Maybe<{ ref?: Ref<Element> }>;
    if (prevProps) applyRef(prevProps.ref, null);
    ref.element.parentNode?.removeChild(ref.element);
  }
}
