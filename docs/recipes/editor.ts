import {
  _,
  createApp,
  HtmlRender,
  button,
  div,
  view,
} from "creo";
import type { PointerEventData } from "creo";
import { createEditor, type Mark } from "creo-editor";

const editor = createEditor({
  initial: {
    blocks: [
      { type: "h2", runs: [{ text: "Hello, Creo Editor" }] },
      {
        type: "p",
        runs: [
          { text: "Type here. Select text and press " },
          { text: "Cmd+B", marks: ["code"] },
          { text: " or " },
          { text: "Cmd+I", marks: ["code"] },
          { text: " to format." },
        ],
      },
      { type: "li", ordered: false, depth: 0, runs: [{ text: "Press Tab to indent" }] },
      { type: "li", ordered: false, depth: 0, runs: [{ text: "Paste rich content" }] },
    ],
  },
});

const Toolbar = view(() => {
  const mark = (m: Mark) => (e: PointerEventData) => {
    e.preventDefault();
    editor.dispatch({ t: "toggleMark", mark: m });
    editor.focus();
  };
  return {
    render() {
      div({ class: "toolbar" }, () => {
        button({ on: { click: mark("b") } }, "B");
        button({ on: { click: mark("i") } }, "I");
        button({ on: { click: mark("u") } }, "U");
        button(
          {
            on: {
              click: (e) => {
                e.preventDefault();
                editor.dispatch({ t: "toggleList", ordered: false });
                editor.focus();
              },
            },
          },
          "• List",
        );
        button(
          {
            on: {
              click: (e) => {
                e.preventDefault();
                editor.dispatch({ t: "toggleList", ordered: true });
                editor.focus();
              },
            },
          },
          "1. List",
        );
        button(
          {
            on: {
              click: (e) => {
                e.preventDefault();
                editor.undo();
                editor.focus();
              },
            },
          },
          "Undo",
        );
        button(
          {
            on: {
              click: (e) => {
                e.preventDefault();
                editor.redo();
                editor.focus();
              },
            },
          },
          "Redo",
        );
      });
    },
  };
});

const App = view(() => ({
  render() {
    Toolbar();
    editor.EditorView();
    void _;
  },
}));

createApp(
  () => App(),
  new HtmlRender(document.getElementById("app")!),
).mount();
