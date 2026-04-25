import { createApp, HtmlRender, _ } from "creo";
// Must come before ./router so the secondary `#anchor` is stripped from
// the URL before createRouter reads location.hash.
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
