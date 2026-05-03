import type { Store } from "creo";
import { insertBlocks } from "../commands/insertCommands";
import {
  insertImageFiles,
  type UploadFn,
} from "../commands/imageCommands";
import { parseHTML, parsePlainText } from "./htmlParser";
import { selectionToClipboard } from "./htmlSerializer";
import {
  deleteBackward as cmdDeleteBackward,
} from "../commands/textCommands";
import type { DocState, Selection } from "../model/types";

export type ClipboardStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type ClipboardOptions = {
  upload?: UploadFn;
};

export type ClipboardHandle = {
  destroy: () => void;
};

/**
 * Wire copy / cut / paste handlers on the editor's hidden textarea.
 *
 *  - copy / cut: serialize the current selection to text/html + text/plain
 *    and write both to the system clipboard via the event's
 *    `clipboardData`. cut additionally deletes the selection afterwards.
 *
 *  - paste: prefer text/html when present; fall back to text/plain. The
 *    user can force plain by holding Shift (we honour the
 *    `e.shiftKey === true` flag of the underlying event when available).
 */
export function attachClipboard(
  textarea: HTMLTextAreaElement,
  stores: ClipboardStores,
  options: ClipboardOptions = {},
): ClipboardHandle {
  const onCopy = (e: Event) => {
    const ev = e as ClipboardEvent;
    const sel = stores.selStore.get();
    if (sel.kind === "caret") return; // nothing to copy
    ev.preventDefault();
    const payload = selectionToClipboard(stores.docStore.get(), sel);
    ev.clipboardData?.setData("text/html", payload.html);
    ev.clipboardData?.setData("text/plain", payload.plain);
  };

  const onCut = (e: Event) => {
    const ev = e as ClipboardEvent;
    const sel = stores.selStore.get();
    if (sel.kind === "caret") return;
    ev.preventDefault();
    const payload = selectionToClipboard(stores.docStore.get(), sel);
    ev.clipboardData?.setData("text/html", payload.html);
    ev.clipboardData?.setData("text/plain", payload.plain);
    // Delete the range — deleteBackward collapses range selections.
    cmdDeleteBackward(stores);
  };

  const onPaste = (e: Event) => {
    const ev = e as ClipboardEvent;
    const data = ev.clipboardData;
    if (!data) return;
    ev.preventDefault();
    // Image files take priority over text — copy-image-from-browser sets
    // both, but the user clearly wants the image when one is available.
    if (data.files && data.files.length > 0) {
      let hasImage = false;
      for (const f of Array.from(data.files)) {
        if (f.type.startsWith("image/")) {
          hasImage = true;
          break;
        }
      }
      if (hasImage) {
        void insertImageFiles(stores, data.files, options.upload);
        return;
      }
    }
    // Detect Shift+Paste — many browsers don't expose modifier state on
    // ClipboardEvent. We watch the most-recent keydown shift state via a
    // closure (see below). Falls back to looking at e as KeyboardEvent only
    // works in tests; for real browsers we have `lastShiftDown`.
    const forcePlain = pasteShiftHeld;
    const html = data.getData("text/html");
    if (!forcePlain && html) {
      const blocks = parseHTML(html);
      if (blocks.length) {
        insertBlocks(stores, blocks);
        return;
      }
    }
    const plain = data.getData("text/plain");
    if (plain) {
      const blocks = parsePlainText(plain);
      if (blocks.length) insertBlocks(stores, blocks);
    }
  };

  // Track Shift as a side-channel so paste handlers can detect Shift+Paste
  // even on browsers that don't include shiftKey on ClipboardEvent.
  let pasteShiftHeld = false;
  const onKeyDown = (e: Event) => {
    pasteShiftHeld = (e as KeyboardEvent).shiftKey === true;
  };
  const onKeyUp = (e: Event) => {
    pasteShiftHeld = (e as KeyboardEvent).shiftKey === true;
  };

  textarea.addEventListener("copy", onCopy);
  textarea.addEventListener("cut", onCut);
  textarea.addEventListener("paste", onPaste);
  textarea.addEventListener("keydown", onKeyDown, true);
  textarea.addEventListener("keyup", onKeyUp, true);

  return {
    destroy() {
      textarea.removeEventListener("copy", onCopy);
      textarea.removeEventListener("cut", onCut);
      textarea.removeEventListener("paste", onPaste);
      textarea.removeEventListener("keydown", onKeyDown, true);
      textarea.removeEventListener("keyup", onKeyUp, true);
    },
  };
}
