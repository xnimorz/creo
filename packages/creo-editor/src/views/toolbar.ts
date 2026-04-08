/**
 * Editor Toolbar — Creo view for formatting controls.
 */

import { view, button, div, span } from "creo";
import type { Store } from "creo";
import { _ } from "creo";
import type { EditorInstance } from "../state/store";
import { toggleBold, toggleItalic, toggleCode, toggleStrikethrough } from "../state/commands";

export interface ToolbarProps {
  readonly editor: Store<EditorInstance>;
  readonly mode: { get(): "wysiwyg" | "source"; set(v: "wysiwyg" | "source"): void };
}

export const Toolbar = view<ToolbarProps>(({ props, use }) => {
  const editor = use(props().editor);

  const handleBold = () => {
    const inst = editor.get();
    toggleBold(inst.state, (steps, sel) => inst.dispatch(steps, sel));
  };

  const handleItalic = () => {
    const inst = editor.get();
    toggleItalic(inst.state, (steps, sel) => inst.dispatch(steps, sel));
  };

  const handleCode = () => {
    const inst = editor.get();
    toggleCode(inst.state, (steps, sel) => inst.dispatch(steps, sel));
  };

  const handleStrikethrough = () => {
    const inst = editor.get();
    toggleStrikethrough(inst.state, (steps, sel) => inst.dispatch(steps, sel));
  };

  const handleModeToggle = () => {
    const mode = props().mode;
    mode.set(mode.get() === "wysiwyg" ? "source" : "wysiwyg");
  };

  return {
    render() {
      div({ class: "creo-editor-toolbar" }, () => {
        div({ class: "creo-editor-toolbar-group" }, () => {
          button({ class: "creo-editor-btn", onClick: handleBold, title: "Bold (Ctrl+B)" }, "B");
          button({ class: "creo-editor-btn creo-editor-btn-italic", onClick: handleItalic, title: "Italic (Ctrl+I)" }, "I");
          button({ class: "creo-editor-btn", onClick: handleCode, title: "Code (Ctrl+`)" }, "<>");
          button({ class: "creo-editor-btn", onClick: handleStrikethrough, title: "Strikethrough" }, "S");
        });

        div({ class: "creo-editor-toolbar-spacer" });

        div({ class: "creo-editor-toolbar-group" }, () => {
          button(
            { class: "creo-editor-btn", onClick: handleModeToggle, title: "Toggle source/WYSIWYG" },
            () => {
              span(_, props().mode.get() === "wysiwyg" ? "Source" : "WYSIWYG");
            },
          );
        });
      });
    },
  };
});
