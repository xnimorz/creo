import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost" });
// happy-dom 20.x leaves window.SyntaxError undefined, which makes its
// querySelectorAll path throw — same workaround the core package uses.
(win as { SyntaxError?: unknown }).SyntaxError = SyntaxError;

Object.assign(globalThis, {
  document: win.document,
  window: win,
  HTMLElement: win.HTMLElement,
  HTMLTextAreaElement: win.HTMLTextAreaElement,
  HTMLInputElement: win.HTMLInputElement,
  HTMLImageElement: win.HTMLImageElement,
  Text: win.Text,
  DocumentFragment: win.DocumentFragment,
  Comment: win.Comment,
  Node: win.Node,
  Range: win.Range,
  Event: win.Event,
  KeyboardEvent: win.KeyboardEvent,
  InputEvent: win.InputEvent,
  CompositionEvent: win.CompositionEvent,
  ClipboardEvent: win.ClipboardEvent,
  PointerEvent: win.PointerEvent,
  MouseEvent: win.MouseEvent,
  DragEvent: win.DragEvent,
  DataTransfer: win.DataTransfer,
});

export { win };

export function makeContainer(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

export function clearDom(): void {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

/** Synchronous scheduler — pass to createApp so tests can inspect the DOM
 *  immediately after a state change (no microtask wait). */
export const SYNC_SCHEDULER = { scheduler: (cb: () => void) => cb() };
