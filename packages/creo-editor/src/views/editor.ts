/**
 * CreoEditor — Top-level editor view.
 *
 * Composes toolbar, WYSIWYG surface, and source surface.
 * Manages mode switching between WYSIWYG and source editing.
 */

import { view, div, textarea } from "creo";
import { _ } from "creo";
import type { Store } from "creo";
import type { EditorInstance } from "../state/store";
import { Toolbar } from "./toolbar";
import { WysiwygSurface } from "./wysiwyg-surface";
import type { InputEventData } from "creo";

export interface EditorProps {
  /** The editor store instance. */
  readonly editor: Store<EditorInstance>;
  /** Optional CSS class for the wrapper. */
  readonly class?: string;
}

export const CreoEditor = view<EditorProps>(({ props, use }) => {
  const editor = use(props().editor);
  const mode = use<"wysiwyg" | "source">("wysiwyg");

  const handleSourceInput = (e: InputEventData) => {
    editor.get().setContent(e.value);
  };

  return {
    render() {
      const p = props();
      const className = ["creo-editor", p.class].filter(Boolean).join(" ");

      div({ class: className }, () => {
        // Toolbar
        Toolbar({ editor: p.editor, mode });

        // Editing surface
        div({ class: "creo-editor-content" }, () => {
          if (mode.get() === "wysiwyg") {
            WysiwygSurface({ editor: p.editor });
          } else {
            // Source mode — raw markdown textarea
            div({ class: "creo-editor-source" }, () => {
              textarea({
                class: "creo-editor-source-textarea",
                value: editor.get().getContent(),
                onInput: handleSourceInput,
              });
            });
          }
        });
      });
    },
  };
});
