/**
 * Standalone mount — allows using creo-editor on any page,
 * even one that doesn't use Creo.
 */

import { createApp, HtmlRender } from "creo";
import type { Store } from "creo";
import { createEditorStore } from "../state/store";
import type { EditorStoreConfig, EditorInstance } from "../state/store";
import { CreoEditor } from "../views/editor";

// ── Public API ─────────────────────────────────────────────────────────

export interface MountOptions {
  /** Target DOM element to mount the editor into. */
  readonly element: HTMLElement;

  /** Initial markdown content. */
  readonly initialContent?: string;

  /** Called whenever the editor content changes. */
  readonly onChange?: (markdown: string) => void;

  /** Additional editor store configuration. */
  readonly config?: Partial<EditorStoreConfig>;
}

export interface EditorHandle {
  /** Get the current content as a markdown string. */
  getContent(): string;

  /** Set the editor content from a markdown string. */
  setContent(markdown: string): void;

  /** Get the underlying Creo store (for advanced use). */
  getStore(): Store<EditorInstance>;

  /** Destroy the editor and clean up. */
  destroy(): void;
}

/**
 * Mount a creo-editor instance on any DOM element.
 *
 * Works on non-Creo pages — creates its own Creo app internally.
 *
 * @example
 * ```ts
 * const handle = mountEditor({
 *   element: document.getElementById("editor")!,
 *   initialContent: "# Hello\n\nWorld",
 *   onChange: (md) => console.log(md),
 * });
 *
 * handle.getContent();        // "# Hello\n\nWorld\n"
 * handle.setContent("# New");
 * handle.destroy();
 * ```
 */
export function mountEditor(options: MountOptions): EditorHandle {
  const { element, initialContent, onChange, config } = options;

  // Create the editor store
  const editorStore = createEditorStore({
    initialContent: initialContent ?? "",
    onChange,
    ...config,
  });

  // Create a Creo app with the editor view
  const renderer = new HtmlRender(element);
  const app = createApp(
    () => CreoEditor({ editor: editorStore }),
    renderer,
  ).mount();

  return {
    getContent() {
      return editorStore.get().getContent();
    },

    setContent(markdown: string) {
      editorStore.get().setContent(markdown);
    },

    getStore() {
      return editorStore;
    },

    destroy() {
      // Clean up the app
      element.innerHTML = "";
    },
  };
}
