import type { CanvasNode } from "./canvas_types";

// ---------------------------------------------------------------------------
// Input overlay — positions a real HTML <input> over a canvas input node
// ---------------------------------------------------------------------------

export class InputOverlay {
  #el: HTMLInputElement;
  #activeNode: CanvasNode | null = null;
  #canvasEl: HTMLCanvasElement;
  #dpr: number;

  constructor(canvasEl: HTMLCanvasElement, dpr: number) {
    this.#canvasEl = canvasEl;
    this.#dpr = dpr;

    const el = document.createElement("input");
    el.type = "text";
    el.style.cssText = `
      position: absolute;
      box-sizing: border-box;
      border: 2px solid #4a90d9;
      outline: none;
      font-family: sans-serif;
      background: #fff;
      z-index: 10000;
      display: none;
    `;
    // Insert after the canvas
    canvasEl.parentElement?.appendChild(el);
    // Make parent positioned if not already
    if (canvasEl.parentElement) {
      const pos = getComputedStyle(canvasEl.parentElement).position;
      if (pos === "static") canvasEl.parentElement.style.position = "relative";
    }

    this.#el = el;

    // Route native events to CanvasNode handlers
    el.addEventListener("input", () => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["input"];
      if (handler) handler({ value: el.value, stopPropagation() {}, preventDefault() {} });
    });

    el.addEventListener("change", () => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["change"];
      if (handler) handler({ value: el.value, stopPropagation() {}, preventDefault() {} });
    });

    el.addEventListener("keydown", (e) => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["keyDown"];
      if (handler) handler({ key: e.key, code: e.code, stopPropagation() { e.stopPropagation(); }, preventDefault() { e.preventDefault(); } });
    });

    el.addEventListener("keyup", (e) => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["keyUp"];
      if (handler) handler({ key: e.key, code: e.code, stopPropagation() { e.stopPropagation(); }, preventDefault() { e.preventDefault(); } });
    });

    el.addEventListener("blur", () => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["blur"];
      if (handler) handler({ stopPropagation() {}, preventDefault() {} });
      this.hide();
    });

    el.addEventListener("focus", () => {
      const node = this.#activeNode;
      if (!node) return;
      const handler = node.events["focus"];
      if (handler) handler({ stopPropagation() {}, preventDefault() {} });
    });
  }

  /** Show the overlay positioned over the given input node. */
  show(node: CanvasNode): void {
    this.#activeNode = node;
    const el = this.#el;

    // Sync value from node props
    const value = node.prevProps?.value;
    el.value = value != null ? String(value) : "";

    // Sync placeholder
    const placeholder = node.prevProps?.placeholder;
    el.placeholder = placeholder != null ? String(placeholder) : "";

    // Sync other props
    const type = node.prevProps?.type;
    el.type = type != null ? String(type) : "text";

    const disabled = node.prevProps?.disabled;
    el.disabled = !!disabled;

    const readOnly = node.prevProps?.readOnly;
    el.readOnly = !!readOnly;

    // Style from node
    el.style.fontSize = `${node.style.fontSize}px`;
    el.style.fontFamily = node.style.fontFamily;
    el.style.color = node.style.color;
    el.style.borderRadius = `${node.style.borderRadius}px`;

    this.reposition();

    el.style.display = "block";
    el.focus();
  }

  /** Hide the overlay. */
  hide(): void {
    this.#el.style.display = "none";
    this.#activeNode = null;
  }

  /** Reposition overlay to match the active node's layout. */
  reposition(): void {
    const node = this.#activeNode;
    if (!node) return;

    const l = node.layout;
    const canvasRect = this.#canvasEl.getBoundingClientRect();

    // Compute position relative to canvas parent
    const parentRect = this.#canvasEl.parentElement?.getBoundingClientRect();
    const offsetX = canvasRect.left - (parentRect?.left ?? 0);
    const offsetY = canvasRect.top - (parentRect?.top ?? 0);

    this.#el.style.left = `${offsetX + l.x}px`;
    this.#el.style.top = `${offsetY + l.y}px`;
    this.#el.style.width = `${l.w}px`;
    this.#el.style.height = `${l.h}px`;
  }

  /** Check if a node is an input that should use the overlay. */
  isInputNode(node: CanvasNode): boolean {
    return node.tag === "input" || node.tag === "textarea";
  }

  get activeNode(): CanvasNode | null {
    return this.#activeNode;
  }

  dispose(): void {
    this.#el.remove();
    this.#activeNode = null;
  }
}
