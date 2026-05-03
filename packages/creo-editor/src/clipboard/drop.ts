import type { Store } from "creo";
import {
  insertImageFiles,
  type UploadFn,
} from "../commands/imageCommands";
import type { DocState, Selection } from "../model/types";

export type DropStores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type DropHandle = { destroy: () => void };

/**
 * Wire dragover + drop on the editor root so dragged image files become
 * image blocks. We only swallow the drop when at least one image file is
 * present; other drops fall through to the browser's default behaviour
 * (so dragging text from elsewhere keeps working).
 */
export function attachDrop(
  root: HTMLElement,
  stores: DropStores,
  upload?: UploadFn,
): DropHandle {
  const onDragOver = (e: Event) => {
    const ev = e as DragEvent;
    if (!ev.dataTransfer) return;
    // Allow drop only when there's at least one image item.
    const items = ev.dataTransfer.items;
    let hasImage = false;
    if (items) {
      for (const it of Array.from(items)) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          hasImage = true;
          break;
        }
      }
    }
    if (hasImage) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    }
  };

  const onDrop = (e: Event) => {
    const ev = e as DragEvent;
    const files = ev.dataTransfer?.files;
    if (!files || files.length === 0) return;
    let hasImage = false;
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) return;
    ev.preventDefault();
    void insertImageFiles(stores, files, upload);
  };

  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", onDrop);

  return {
    destroy() {
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
    },
  };
}
