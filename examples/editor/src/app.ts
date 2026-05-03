import { _ } from "creo";
import { button, div, option, select, view } from "creo";
import type { InputEventData, PointerEventData } from "creo";
import { createEditor, type Mark } from "creo-editor";

// Mode + initial-doc are URL-driven so the same example app can demonstrate
// both regular and mono editing without separate routes:
//   /          → regular
//   /?mode=mono → monospace (good for code / markdown source)
const __urlMode = (() => {
  if (typeof window === "undefined") return "regular" as const;
  const m = new URLSearchParams(window.location.search).get("mode");
  return m === "mono" ? ("mono" as const) : ("regular" as const);
})();

export const editor = createEditor({
  mode: __urlMode,
  initial: {
    blocks: [
      { type: "h1", runs: [{ text: "Welcome to Creo Editor" }] },
      {
        type: "p",
        runs: [
          { text: "This is a " },
          { text: "no-contentEditable", marks: ["code"] },
          {
            text:
              ", row-based rich text editor built on top of the Creo UI framework.",
          },
        ],
      },
      { type: "h2", runs: [{ text: "Try these" }] },
      {
        type: "li",
        ordered: false,
        depth: 0,
        runs: [{ text: "Type something here" }],
      },
      {
        type: "li",
        ordered: false,
        depth: 0,
        runs: [{ text: "Select text and press Cmd+B / Cmd+I" }],
      },
      {
        type: "li",
        ordered: false,
        depth: 0,
        runs: [{ text: "Press Tab to indent, Shift+Tab to outdent" }],
      },
      {
        type: "li",
        ordered: false,
        depth: 0,
        runs: [{ text: "Paste rich content from the web" }],
      },
      {
        type: "p",
        runs: [
          { text: "Edit me. Or use the toolbar above to format." },
        ],
      },
    ],
  },
});

const blockTypes = [
  { v: "p", label: "Paragraph" },
  { v: "h1", label: "Heading 1" },
  { v: "h2", label: "Heading 2" },
  { v: "h3", label: "Heading 3" },
  { v: "h4", label: "Heading 4" },
  { v: "h5", label: "Heading 5" },
  { v: "h6", label: "Heading 6" },
] as const;

const Toolbar = view(() => {
  const onTypeChange = (e: InputEventData) => {
    const v = e.value as (typeof blockTypes)[number]["v"];
    editor.dispatch({ t: "setBlockType", payload: { type: v } });
    editor.focus();
  };
  const mark = (m: Mark) => (e: PointerEventData) => {
    e.preventDefault();
    editor.dispatch({ t: "toggleMark", mark: m });
    editor.focus();
  };
  const list = (ordered: boolean) => (e: PointerEventData) => {
    e.preventDefault();
    editor.dispatch({ t: "toggleList", ordered });
    editor.focus();
  };
  const insertImage = (e: PointerEventData) => {
    e.preventDefault();
    const src = window.prompt("Image URL?");
    if (src) editor.dispatch({ t: "insertImage", src });
    editor.focus();
  };
  const insertTable = (e: PointerEventData) => {
    e.preventDefault();
    editor.dispatch({ t: "insertTable", rows: 3, cols: 3 });
    editor.focus();
  };
  const insertColumns = (e: PointerEventData) => {
    e.preventDefault();
    editor.dispatch({ t: "insertColumns", cols: 2 });
    editor.focus();
  };
  const undo = (e: PointerEventData) => {
    e.preventDefault();
    editor.undo();
    editor.focus();
  };
  const redo = (e: PointerEventData) => {
    e.preventDefault();
    editor.redo();
    editor.focus();
  };

  return {
    render() {
      div({ class: "toolbar" }, () => {
        select({ onChange: onTypeChange }, () => {
          for (const t of blockTypes) {
            option({ value: t.v }, t.label);
          }
        });
        div({ class: "sep" });
        button({ onClick: mark("b") }, "B");
        button({ onClick: mark("i") }, "I");
        button({ onClick: mark("u") }, "U");
        button({ onClick: mark("s") }, "S");
        button({ onClick: mark("code") }, "</>");
        div({ class: "sep" });
        button({ onClick: list(false) }, "• List");
        button({ onClick: list(true) }, "1. List");
        div({ class: "sep" });
        button({ onClick: insertImage }, "Image");
        button({ onClick: insertTable }, "Table");
        button({ onClick: insertColumns }, "Columns");
        div({ class: "sep" });
        button({ onClick: undo }, "Undo");
        button({ onClick: redo }, "Redo");
      });
    },
  };
});

export const App = view(() => ({
  render() {
    Toolbar();
    editor.EditorView();
    void _;
  },
}));
