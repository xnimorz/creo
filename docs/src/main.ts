import { createApp, HtmlRender, _ } from "creo";
// Must precede ./router: strips the secondary `#anchor` first
import "./anchor";
import { Layout } from "./views/Layout";
import { RouterView } from "./router";
import "./styles.css";
import "highlight.js/styles/github.css";

const el = document.getElementById("app")!;

createApp(
  () => {
    Layout(_, () => {
      RouterView();
    });
  },
  new HtmlRender(el),
).mount();
