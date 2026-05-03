import type { Store } from "creo";
import { insertImage as cmdInsertImage } from "./insertCommands";
import { removeBlock } from "../model/doc";
import { caret, isCaret } from "../controller/selection";
import type { DocState, Selection } from "../model/types";

export type Stores = {
  docStore: Store<DocState>;
  selStore: Store<Selection>;
};

export type UploadFn = (file: File) => Promise<string>;

/**
 * Pick an image source for a File. If `upload` is provided, await its URL;
 * otherwise fall back to `URL.createObjectURL`.
 */
export async function fileToImageSrc(
  file: File,
  upload?: UploadFn,
): Promise<string> {
  if (upload) return upload(file);
  return URL.createObjectURL(file);
}

/**
 * Drop / paste a single File into the editor as an image block. Async
 * (must await an upload when configured).
 */
export async function insertImageFile(
  stores: Stores,
  file: File,
  upload?: UploadFn,
): Promise<boolean> {
  if (!file.type.startsWith("image/")) return false;
  const src = await fileToImageSrc(file, upload);
  return cmdInsertImage(stores, { src, alt: file.name });
}

/**
 * Process a FileList (from paste or drop). Each image becomes its own block;
 * non-image files are ignored.
 */
export async function insertImageFiles(
  stores: Stores,
  files: FileList | File[],
  upload?: UploadFn,
): Promise<boolean> {
  let any = false;
  const list = Array.from(files);
  for (const f of list) {
    if (!f.type.startsWith("image/")) continue;
    if (await insertImageFile(stores, f, upload)) any = true;
  }
  return any;
}

/**
 * Delete the image block currently under the caret (used by Backspace when
 * the caret sits on an image).
 */
export function deleteSelectedImage(stores: Stores): boolean {
  const sel = stores.selStore.get();
  if (!isCaret(sel)) return false;
  const doc = stores.docStore.get();
  const block = doc.byId.get(sel.at.blockId);
  if (!block || block.type !== "img") return false;
  // Find adjacent block to land caret on.
  const i = doc.order.indexOf(block.id);
  const next = removeBlock(doc, block.id);
  stores.docStore.set(next);
  const newId = next.order[i] ?? next.order[i - 1] ?? next.order[0];
  if (newId == null) {
    stores.selStore.set(caret({ blockId: "", path: [0], offset: 0 }));
  } else {
    stores.selStore.set(caret({ blockId: newId, path: [0], offset: 0 }));
  }
  return true;
}
