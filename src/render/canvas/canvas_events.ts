import type { CanvasNode } from "./canvas_types";
import type { InputOverlay } from "./canvas_input";

// ---------------------------------------------------------------------------
// Event data types (mirrors HtmlRender's engine-agnostic types)
// ---------------------------------------------------------------------------

type EventData = Record<string, unknown>;

function makePointerData(e: PointerEvent | MouseEvent, canvasEl: HTMLCanvasElement): EventData {
  let stopped = false;
  return {
    x: e.clientX,
    y: e.clientY,
    stopPropagation() { stopped = true; e.stopPropagation(); },
    preventDefault() { e.preventDefault(); },
    get _stopped() { return stopped; },
  };
}

function makeKeyData(e: KeyboardEvent): EventData {
  let stopped = false;
  return {
    key: e.key,
    code: e.code,
    stopPropagation() { stopped = true; e.stopPropagation(); },
    preventDefault() { e.preventDefault(); },
    get _stopped() { return stopped; },
  };
}

// ---------------------------------------------------------------------------
// DOM event name → Creo handler name
// ---------------------------------------------------------------------------

const DOM_TO_HANDLER: Record<string, string> = {
  click: "click",
  dblclick: "dblclick",
  pointerdown: "pointerDown",
  pointerup: "pointerUp",
  pointermove: "pointerMove",
  keydown: "keyDown",
  keyup: "keyUp",
  focus: "focus",
  blur: "blur",
};

// ---------------------------------------------------------------------------
// Hit testing — back-to-front traversal, deepest hit wins
// ---------------------------------------------------------------------------

export function hitTest(node: CanvasNode, x: number, y: number): CanvasNode | null {
  const l = node.layout;

  if (node.style.display === "none") return null;

  // Check children back-to-front (later = on top)
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i]!;
    const hit = hitTest(child, x, y);
    if (hit) return hit;
  }

  // Check self
  if (x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h) {
    return node;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Event bubbling — walk up parent chain, call matching handlers
// ---------------------------------------------------------------------------

function bubbleEvent(node: CanvasNode | null, handlerName: string, data: EventData): void {
  let current = node;
  while (current) {
    const handler = current.events[handlerName];
    if (handler) {
      handler(data);
      if ((data as { _stopped?: boolean })._stopped) return;
    }
    current = current.parent;
  }
}

/** Walk up from node to find the nearest ancestor (or self) that is an input/textarea. */
function findInputAncestor(node: CanvasNode | null): CanvasNode | null {
  let current = node;
  while (current) {
    if (current.tag === "input" || current.tag === "textarea") return current;
    current = current.parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Setup event listeners on canvas element
// ---------------------------------------------------------------------------

export type EventCleanup = () => void;

export function setupEvents(
  ctx: { canvasEl: HTMLCanvasElement; dpr: number },
  root: () => CanvasNode | null,
  inputOverlay?: InputOverlay | null,
): EventCleanup {
  const { canvasEl } = ctx;
  const listeners: [string, EventListener][] = [];
  let focusedNode: CanvasNode | null = null;

  function on<E extends Event>(event: string, handler: (e: E) => void) {
    canvasEl.addEventListener(event, handler as EventListener);
    listeners.push([event, handler as EventListener]);
  }

  // Pointer events
  function handlePointer(e: PointerEvent) {
    const r = root();
    if (!r) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const target = hitTest(r, x, y);
    if (!target && e.type !== "pointermove") return;

    const handlerName = DOM_TO_HANDLER[e.type];
    if (!handlerName) return;

    const data = makePointerData(e, canvasEl);

    // On click: handle focus and input overlay
    if (e.type === "click" && target) {
      const inputNode = findInputAncestor(target);
      if (inputNode && inputOverlay) {
        inputOverlay.show(inputNode);
        focusedNode = inputNode;
        // Still bubble the click event
      } else if (inputOverlay?.activeNode) {
        // Clicked outside input — blur it
        inputOverlay.hide();
      }
      focusedNode = target;
    }

    bubbleEvent(target, handlerName, data);
  }

  on<PointerEvent>("click", handlePointer);
  on<PointerEvent>("dblclick", handlePointer);
  on<PointerEvent>("pointerdown", handlePointer);
  on<PointerEvent>("pointerup", handlePointer);
  on<PointerEvent>("pointermove", handlePointer);

  // Keyboard events — dispatch to focused node
  function handleKey(e: KeyboardEvent) {
    // If the input overlay is active, let it handle keyboard events natively
    if (inputOverlay?.activeNode) return;

    const r = root();
    if (!r) return;

    const handlerName = DOM_TO_HANDLER[e.type];
    if (!handlerName) return;

    const data = makeKeyData(e);
    // Bubble from focused node or root
    bubbleEvent(focusedNode || r, handlerName, data);
  }

  on<KeyboardEvent>("keydown", handleKey);
  on<KeyboardEvent>("keyup", handleKey);

  // Make canvas focusable for keyboard events
  if (!canvasEl.getAttribute("tabindex")) {
    canvasEl.setAttribute("tabindex", "0");
  }

  return () => {
    for (const [event, handler] of listeners) {
      canvasEl.removeEventListener(event, handler);
    }
    listeners.length = 0;
  };
}
