import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const styleSheet = new CanvasStyleSheet().registerAll({
  // Shell
  shell: { maxWidth: 640, padding: 32, flexDirection: "column", gap: 24 },

  // Nav bar
  nav: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 6,
    padding: 6,
    height: 44,
  },
  // Nav links styled via <a> tag — Link wraps an <a>
  active: { backgroundColor: "#4a90d9", color: "#ffffff", borderRadius: 4, padding: 8, paddingLeft: 14, paddingRight: 14, fontSize: 14, fontWeight: 500, height: 32, textAlign: "center" },

  // Content area
  content: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 6,
    padding: 24,
    minHeight: 200,
    flexDirection: "column",
    gap: 8,
  },

  // User list
  "user-list": { flexDirection: "column" },

  // Profile card
  "profile-card": {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eeeeee",
    flexDirection: "column",
    gap: 4,
  },

  // Back link
  "back-link": { color: "#4a90d9", fontSize: 14, marginTop: 16, height: 20 },

  // Not found
  "not-found": { textAlign: "center", padding: 40, color: "#999999", flexDirection: "column", gap: 8 },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });
createApp(() => App(), renderer).mount();
